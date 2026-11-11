extends Node3D
## A real 3D casino scene. Geometry, UI and animation are independent of the
## authoritative blackjack engine. No external assets or paid services required.

const NetworkScript = preload("res://scripts/casino_network.gd")
const FONT = preload("res://assets/table-font.ttf")
const GOLD = Color("bca477")
const CREAM = Color("efe5cd")
const PHASES = {"idle": "Faites vos jeux", "betting": "Les mises sont ouvertes", "dealing": "Distribution des cartes", "player_turns": "Tour des joueurs", "dealer_reveal": "Le croupier révèle son jeu", "dealer_turns": "Le croupier joue", "payout": "Résultats de la manche"}

var net: CasinoNetwork
var camera: Camera3D
var dealer_arm: Node3D
var dealer_body: Node3D
var phase_label: Label
var balance_label: Label
var guidance: Label
var timer_label: Label
var status_label: Label
var error_label: Label
var seat_bar: HBoxContainer
var bet_row: HBoxContainer
var actions_row: HBoxContainer
var login: PanelContainer
var pseudo_input: LineEdit
var controls_panel: PanelContainer
var seat_labels: Dictionary = {}
var seat_rings: Dictionary = {}
var seat_chairs: Dictionary = {}
var cards: Dictionary = {}
var chips: Dictionary = {}
var hand_totals: Dictionary = {}
var animated_cards: Dictionary = {}
var table: Dictionary = {}
var player: Dictionary = {}
var selected_seat := 4
var seat_request := 0
var seated := false
var active_case := 0
var selected_bet_case := 0
var connected := false
var has_initial_state := false
var elapsed := 0.0
var camera_tween: Tween
var arm_tween: Tween
var error_until := 0.0
var sound_player: AudioStreamPlayer
var muted := false
var reduced_motion := false
var demo_mode := false
var compact := false
var status_row: HBoxContainer

func _ready() -> void:
	get_viewport().msaa_3d = Viewport.MSAA_8X
	for argument in OS.get_cmdline_user_args():
		if argument == "--demo": demo_mode = true
		if argument == "--reduced-motion": reduced_motion = true
	_build_room()
	_build_table()
	_build_dealer()
	_build_ui()
	net = NetworkScript.new()
	net.stopped = true
	add_child(net)
	net.table_received.connect(_on_table)
	net.player_received.connect(_on_player)
	net.card_dealt.connect(_on_deal)
	net.connection_changed.connect(_on_connection)
	net.error_received.connect(_show_error)
	net.round_result.connect(_on_results)
	pseudo_input.text = net.pseudo if net.pseudo != "JOUEUR" else ""
	sound_player = AudioStreamPlayer.new()
	add_child(sound_player)
	if demo_mode:
		_start_demo()
	else:
		for argument in OS.get_cmdline_user_args():
			if argument.begins_with("--pseudo="):
				pseudo_input.text = argument.trim_prefix("--pseudo=")
				_join()
	get_viewport().size_changed.connect(_adapt_view)
	_adapt_view()

func _material(color: Color, metal := 0.0, roughness := 0.7) -> StandardMaterial3D:
	var result := StandardMaterial3D.new()
	result.albedo_color = color
	result.metallic = metal
	result.roughness = roughness
	result.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	return result

func _mesh(mesh_value: Mesh, material: Material, at: Vector3, parent: Node3D = self) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.mesh = mesh_value
	instance.material_override = material
	instance.position = at
	parent.add_child(instance)
	return instance

func _box(size_value: Vector3, at: Vector3, material: Material, parent: Node3D = self) -> MeshInstance3D:
	var box := BoxMesh.new()
	box.size = size_value
	return _mesh(box, material, at, parent)

func _cylinder(radius: float, height: float, at: Vector3, material: Material, parent: Node3D = self) -> MeshInstance3D:
	var cylinder := CylinderMesh.new()
	cylinder.top_radius = radius
	cylinder.bottom_radius = radius
	cylinder.height = height
	cylinder.radial_segments = 96
	return _mesh(cylinder, material, at, parent)

func _sphere(radius: float, at: Vector3, material: Material, parent: Node3D = self) -> MeshInstance3D:
	var sphere := SphereMesh.new()
	sphere.radius = radius
	sphere.height = radius * 2
	sphere.radial_segments = 64
	sphere.rings = 32
	return _mesh(sphere, material, at, parent)

func _segment(from: Vector3, to: Vector3, radius: float, material: Material, parent: Node3D = self) -> MeshInstance3D:
	var segment := _cylinder(radius, from.distance_to(to), (from + to) / 2, material, parent)
	segment.quaternion = Quaternion(Vector3.UP, (to - from).normalized())
	return segment

func _label_3d(text_value: String, at: Vector3, font_size := 38, color := GOLD) -> Label3D:
	var label := Label3D.new()
	label.text = text_value
	label.font = FONT
	label.font_size = font_size
	label.pixel_size = 0.004
	label.modulate = color
	label.outline_size = 0
	label.position = at
	label.no_depth_test = false
	label.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	label.alpha_cut = Label3D.ALPHA_CUT_OPAQUE_PREPASS
	add_child(label)
	return label

func _build_room() -> void:
	var world := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("080f13")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("becbd5")
	environment.ambient_light_energy = .22
	# A dim sky supplies neutral reflections to the brass and leather.
	var sky := Sky.new()
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color("101b26")
	sky_material.sky_horizon_color = Color("68717a")
	sky_material.ground_bottom_color = Color("0a1116")
	sky_material.ground_horizon_color = Color("68717a")
	sky_material.sky_energy_multiplier = .35
	sky_material.ground_energy_multiplier = .2
	sky.sky_material = sky_material
	environment.sky = sky
	environment.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	world.environment = environment
	add_child(world)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-58, -28, 0)
	key.light_color = Color("fff5e9")
	key.light_energy = .48
	key.shadow_enabled = true
	key.light_angular_distance = 1.5
	key.directional_shadow_max_distance = 18
	key.shadow_bias = .03
	add_child(key)
	var table_light := OmniLight3D.new()
	table_light.position = Vector3(-1.5, 4.6, .7)
	table_light.light_color = Color("ffefdc")
	table_light.light_energy = .85
	table_light.omni_range = 9
	add_child(table_light)
	var fill := OmniLight3D.new()
	fill.position = Vector3(3, 3, -1.5)
	fill.light_color = Color("c7dbed")
	fill.light_energy = .55
	fill.omni_range = 8
	add_child(fill)
	var wall := _material(Color("101b20"), .05, .85)
	var brass := _material(Color("8d7653"), .55, .4)
	_box(Vector3(40, .12, 40), Vector3(0, -.1, 0), _material(Color("0c1216"), .1, .45))
	_box(Vector3(25, 8, .25), Vector3(0, 3.8, -6), wall)
	for x in [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5]:
		_box(Vector3(.025, 4.8, .045), Vector3(x, 2.9, -5.83), brass)
		_box(Vector3(2.7, .025, .045), Vector3(x + 1.5, .5, -5.83), brass)
		_box(Vector3(2.7, .025, .045), Vector3(x + 1.5, 5.3, -5.83), brass)
	for x in [-4.8, 4.8]:
		_cylinder(.11, 3.4, Vector3(x, 1.7, -3.8), _material(Color("1e2a30"), .25, .4))
		_cylinder(.15, .055, Vector3(x, 3.3, -3.8), brass)
		var shade := _material(Color("ddc8a0"), .05, .8)
		shade.emission_enabled = true
		shade.emission = Color("9a7b4e")
		shade.emission_energy_multiplier = .25
		_cylinder(.21, .46, Vector3(x, 3.05, -3.8), shade)
		var lamp := OmniLight3D.new()
		lamp.position = Vector3(x, 3.05, -3.5)
		lamp.light_color = Color("ffdbad")
		lamp.light_energy = .45
		lamp.omni_range = 3
		add_child(lamp)
	var sign_label := _label_3d("21", Vector3(0, 3.9, -5.8), 160, Color("b9a27a"))
	sign_label.pixel_size = .005
	_label_3d("S A L O N   P R I V É", Vector3(0, 3.25, -5.79), 27, Color("9a907b"))
	camera = Camera3D.new()
	camera.position = Vector3(0, 3.7, 7.7)
	camera.fov = 68
	camera.current = true
	add_child(camera)
	camera.look_at(Vector3(0, 1.25, -.75))

func _build_table() -> void:
	var gold := _material(Color("a98c60"), .6, .38)
	var rail := _material(Color("30271f"), .1, .43)
	var base := _cylinder(2.65, .3, Vector3(0, .78, 0), rail)
	base.scale = Vector3(1.3, 1, .8)
	var rim := _cylinder(2.65, .045, Vector3(0, .95, 0), gold)
	rim.scale = Vector3(1.3, 1, .8)
	var cushion := _torus(2.52, .12, Vector3(0, 1.01, 0), _material(Color("17262a"), .05, .43))
	cushion.scale = Vector3(1.3, .7, .8)
	var felt_material := _material(Color("103c31"), 0, .98)
	var noise := FastNoiseLite.new()
	noise.frequency = .65
	var texture := NoiseTexture2D.new()
	texture.width = 512
	texture.height = 512
	texture.noise = noise
	texture.as_normal_map = true
	felt_material.normal_enabled = true
	felt_material.normal_texture = texture
	felt_material.normal_scale = .025
	var felt := _cylinder(2.43, .03, Vector3(0, 1.085, 0), felt_material)
	felt.scale = Vector3(1.3, 1, .8)
	var pedestal := _cylinder(1.15, .7, Vector3(0, .38, 0), _material(Color("1d231b"), .3))
	pedestal.scale.x = 1.5
	var felt_title := _label_3d("L A   T A B L E   2 1", Vector3(0, 1.112, -.1), 58, Color("bda974"))
	felt_title.rotation_degrees.x = -90
	var rules := _label_3d("BLACKJACK PAYS 3 TO 2\nLE CROUPIER RESTE À 17", Vector3(0, 1.114, .55), 20, Color("b0a679"))
	rules.rotation_degrees.x = -90
	for number in range(1, 8):
		var pos := _seat_position(number)
		var ring := TorusMesh.new()
		ring.inner_radius = .33
		ring.outer_radius = .35
		ring.rings = 48
		ring.ring_segments = 8
		seat_rings[number] = _mesh(ring, _material(Color("a18d56"), .4), pos)
		var seat_label := _label_3d(str(number) + " · LIBRE", pos + Vector3(0, .02, .48), 25)
		seat_label.rotation_degrees.x = -67
		seat_label.pixel_size = .0024
		seat_labels[number] = seat_label
		var body := StaticBody3D.new()
		body.position = pos
		body.set_meta("seat", number)
		var hitbox := CollisionShape3D.new()
		var shape := CylinderShape3D.new()
		shape.radius = .5
		shape.height = .12
		hitbox.shape = shape
		body.add_child(hitbox)
		add_child(body)
		var chair_pos := Vector3(pos.x * 1.3, .55, pos.z * 1.5)
		var chair := _sphere(.38, chair_pos, _material(Color("1c2b2e"), .05, .46))
		chair.scale = Vector3(1, .22, .9)
		_cylinder(.06, .5, chair_pos - Vector3(0, .3, 0), gold)
		var back := _sphere(.4, chair_pos + Vector3(0, .4, .31), _material(Color("1c2b2e"), .05, .46))
		back.scale = Vector3(.95, 1, .22)
		back.rotation.y = _seat_angle(number)
		seat_chairs[number] = [chair, back]
	# The card shoe and chip tray are physical props, separate from the dealer.
	var shoe := _box(Vector3(.5, .25, .65), Vector3(1.15, 1.24, -1.25), _material(Color("2c3932"), .5, .25))
	shoe.rotation_degrees.y = -15
	for index in range(8):
		_box(Vector3(.25, .007, .34), Vector3(1.15, 1.37 + index * .009, -1.25), _material(CREAM))
	_box(Vector3(1.05, .08, .42), Vector3(-1.2, 1.17, -1.25), _material(Color("0b110e")))
	for column in range(5):
		for layer in range(6):
			_cylinder(.078, .025, Vector3(-1.6 + column * .2, 1.24 + layer * .026, -1.25), _material([Color("a63743"), Color("295e94"), GOLD, Color("27734f"), Color("484242")][column]))

func _seat_angle(number: int) -> float:
	return deg_to_rad((number - 4) * 23.0)

func _seat_position(number: int) -> Vector3:
	var angle := _seat_angle(number)
	return Vector3(sin(angle) * 2.75, 1.125, cos(angle) * 1.5 + .2)

func _torus(radius: float, thickness: float, at: Vector3, material: Material) -> MeshInstance3D:
	var ring := TorusMesh.new()
	ring.inner_radius = radius - thickness
	ring.outer_radius = radius + thickness
	ring.rings = 128
	ring.ring_segments = 16
	return _mesh(ring, material, at)

func _tailored_shape(sections: Array, material: Material, parent: Node3D) -> MeshInstance3D:
	# Continuous, smooth normals across the silhouette, including the shoulder
	# and jaw transitions. Sections contain height, half-width and half-depth.
	var vertices := PackedVector3Array()
	var normals := PackedVector3Array()
	var indices := PackedInt32Array()
	var segments := 64
	for row in sections.size():
		var section: Vector3 = sections[row]
		var before: Vector3 = sections[maxi(0, row - 1)]
		var after: Vector3 = sections[mini(sections.size() - 1, row + 1)]
		for column in segments:
			var angle := TAU * column / segments
			var c := cos(angle)
			var q := sin(angle)
			vertices.append(Vector3(c * section.y, section.x, q * section.z))
			var along := Vector3(c * (after.y - before.y), after.x - before.x, q * (after.z - before.z))
			var around := Vector3(-q * section.y, 0, c * section.z)
			normals.append(along.cross(around).normalized())
	for row in sections.size() - 1:
		for column in segments:
			var a := row * segments + column
			var b := row * segments + (column + 1) % segments
			var c := a + segments
			var d := b + segments
			indices.append_array(PackedInt32Array([a, b, c, b, d, c]))
	var arrays: Array = []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_INDEX] = indices
	var shape := ArrayMesh.new()
	shape.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return _mesh(shape, material, Vector3.ZERO, parent)

func _lapel(points: Array, material: Material, parent: Node3D) -> void:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for index in range(1, points.size() - 1):
		for vertex in [points[0], points[index], points[index + 1]]:
			surface.set_normal(Vector3.BACK)
			surface.add_vertex(vertex)
	var cloth: StandardMaterial3D = material.duplicate()
	cloth.cull_mode = BaseMaterial3D.CULL_DISABLED
	_mesh(surface.commit(), cloth, Vector3.ZERO, parent)

func _build_dealer() -> void:
	var suit := _material(Color("17222e"), .02, .72)
	var lapel := _material(Color("263444"), .05, .5)
	var shirt := _material(Color("d9d6cf"), 0, .9)
	var skin := _material(Color("bf967e"), 0, .8)
	var hair := _material(Color("252027"), .02, .65)
	dealer_body = Node3D.new()
	dealer_body.position = Vector3(0, -.1, -2.4)
	add_child(dealer_body)
	_tailored_shape([Vector3(1.33,.28,.17), Vector3(1.45,.32,.19), Vector3(1.75,.34,.22), Vector3(2.04,.43,.23), Vector3(2.17,.45,.2), Vector3(2.28,.31,.16), Vector3(2.35,.15,.12)], suit, dealer_body)
	_lapel([Vector3(-.15,2.29,.255), Vector3(.15,2.29,.255), Vector3(.1,1.73,.255), Vector3(0,1.62,.255), Vector3(-.1,1.73,.255)], shirt, dealer_body)
	for side in [-1, 1]:
		_lapel([Vector3(side*.17,2.31,.27), Vector3(side*.36,2.17,.265), Vector3(side*.21,1.99,.28), Vector3(side*.27,1.91,.275), Vector3(side*.07,1.62,.27)], lapel, dealer_body)
		_lapel([Vector3(side*.02,2.19,.285), Vector3(side*.16,2.31,.275), Vector3(side*.14,2.12,.29)], shirt, dealer_body)
		var bow := _sphere(.065, Vector3(side*.058,2.18,.31), hair, dealer_body)
		bow.scale = Vector3(1,.57,.3)
	_sphere(.023, Vector3(0,2.18,.33), hair, dealer_body)
	_cylinder(.105, .2, Vector3(0,2.42,0), skin, dealer_body)
	_tailored_shape([Vector3(2.47,.08,.1),Vector3(2.5,.125,.15),Vector3(2.57,.175,.185),Vector3(2.67,.205,.205),Vector3(2.79,.21,.2),Vector3(2.9,.185,.185),Vector3(2.98,.115,.12),Vector3(3.01,.001,.001)], skin, dealer_body)
	var hair_cap := _sphere(.22, Vector3(0,2.92,-.035), hair, dealer_body)
	hair_cap.scale = Vector3(.98,.55,.88)
	for side in [-1,1]:
		var ear := _sphere(.045, Vector3(side*.205,2.72,0), skin, dealer_body)
		ear.scale = Vector3(.5,1,.6)
		var white := _sphere(.033, Vector3(side*.078,2.775,.183), shirt, dealer_body)
		white.scale = Vector3(1,.43,.35)
		var iris := _sphere(.013, Vector3(side*.078,2.773,.195), hair, dealer_body)
		iris.scale.z = .4
		_segment(Vector3(side*.043,2.822,.178),Vector3(side*.113,2.814,.17),.009,hair,dealer_body)
	var nose := _sphere(.031, Vector3(0,2.695,.21),skin,dealer_body)
	nose.scale = Vector3(.65,1.5,1.2)
	_segment(Vector3(-.052,2.601,.177),Vector3(0,2.592,.19),.006,_material(Color("805e55")),dealer_body)
	_segment(Vector3(0,2.592,.19),Vector3(.052,2.601,.177),.006,_material(Color("805e55")),dealer_body)
	for y in [1.79,1.6]: _sphere(.015,Vector3(.035,y,.24),_material(GOLD,.6),dealer_body)
	_box(Vector3(.14,.045,.01),Vector3(-.29,2.07,.207),_material(GOLD,.6),dealer_body)
	_segment(Vector3(-.38,2.14,.02),Vector3(-.53,1.6,.4),.12,suit,dealer_body)
	_segment(Vector3(-.53,1.6,.4),Vector3(-.26,1.21,.86),.095,suit,dealer_body)
	_sphere(.09,Vector3(-.26,1.2,.91),skin,dealer_body)
	dealer_arm = Node3D.new()
	dealer_arm.position = Vector3(.38,2.14,.02)
	dealer_body.add_child(dealer_arm)
	_segment(Vector3.ZERO,Vector3(.17,-.54,.4),.12,suit,dealer_arm)
	_segment(Vector3(.17,-.54,.4),Vector3(-.12,-.94,.85),.095,suit,dealer_arm)
	_cylinder(.097,.06,Vector3(-.12,-.91,.85),shirt,dealer_arm)
	var hand := _sphere(.1,Vector3(-.12,-.94,.95),skin,dealer_arm)
	hand.scale = Vector3(.8,.42,1.15)
	for finger in range(4):
		_segment(Vector3(-.177+finger*.033,-.94,1),Vector3(-.177+finger*.033,-.96,1.09),.016,skin,dealer_arm)

func _style_panel(color := Color("101d18"), border := Color("665d41")) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = border
	style.set_border_width_all(1)
	style.set_corner_radius_all(12)
	style.content_margin_left = 18
	style.content_margin_right = 18
	style.content_margin_top = 12
	style.content_margin_bottom = 12
	return style

func _button(text_value: String, callback: Callable, min_width := 90) -> Button:
	var button := Button.new()
	button.text = text_value
	button.custom_minimum_size = Vector2(min_width, 42)
	button.add_theme_stylebox_override("normal", _style_panel())
	button.add_theme_stylebox_override("hover", _style_panel(Color("2c3c2b"), GOLD))
	button.add_theme_stylebox_override("pressed", _style_panel(Color("4b4930"), GOLD))
	button.add_theme_stylebox_override("disabled", _style_panel(Color("0e1512"), Color("2b3229")))
	button.add_theme_color_override("font_color", CREAM)
	button.add_theme_color_override("font_disabled_color", Color("62695b"))
	button.pressed.connect(callback)
	return button

func _ui_label(text_value: String, font_size := 16, color := CREAM) -> Label:
	var label := Label.new()
	label.text = text_value
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return label

func _build_ui() -> void:
	var canvas := CanvasLayer.new()
	add_child(canvas)
	var ui := Control.new()
	ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var theme := Theme.new()
	theme.default_font = FONT
	theme.default_font_size = 14
	ui.theme = theme
	canvas.add_child(ui)
	var top := MarginContainer.new()
	top.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	top.add_theme_constant_override("margin_left", 24)
	top.add_theme_constant_override("margin_right", 24)
	top.add_theme_constant_override("margin_top", 18)
	ui.add_child(top)
	var top_row := HBoxContainer.new()
	status_row = top_row
	top.add_child(top_row)
	status_label = _ui_label("●  SALON PRIVÉ", 13, GOLD)
	top_row.add_child(status_label)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top_row.add_child(spacer)
	balance_label = _ui_label("LA TABLE 21", 17, GOLD)
	top_row.add_child(balance_label)
	var mute_button := _button("Son : ON", func(): muted = not muted; mute_button_update(), 80)
	mute_button.name = "SoundToggle"
	top_row.add_child(mute_button)
	var motion_button := _button("Animations : ON", func(): reduced_motion = not reduced_motion; _refresh_motion_button(), 100)
	motion_button.name = "MotionToggle"
	top_row.add_child(motion_button)
	var title := VBoxContainer.new()
	title.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	title.position = Vector2(-200, 70)
	title.size = Vector2(400, 90)
	title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(title)
	title.add_child(_ui_label("LA TABLE 21", 28, GOLD))
	phase_label = _ui_label("Prenez place au salon", 14)
	title.add_child(phase_label)
	timer_label = _ui_label("", 13, GOLD)
	title.add_child(timer_label)
	var bottom := MarginContainer.new()
	bottom.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	bottom.grow_vertical = Control.GROW_DIRECTION_BEGIN
	bottom.add_theme_constant_override("margin_left", 16)
	bottom.add_theme_constant_override("margin_right", 16)
	bottom.add_theme_constant_override("margin_bottom", 16)
	ui.add_child(bottom)
	controls_panel = PanelContainer.new()
	controls_panel.add_theme_stylebox_override("panel", _style_panel(Color(.025, .055, .04, .94)))
	bottom.add_child(controls_panel)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	controls_panel.add_child(column)
	guidance = _ui_label("Choisissez une place libre pour vous asseoir", 14, CREAM)
	column.add_child(guidance)
	seat_bar = HBoxContainer.new()
	seat_bar.alignment = BoxContainer.ALIGNMENT_CENTER
	column.add_child(seat_bar)
	bet_row = HBoxContainer.new()
	bet_row.alignment = BoxContainer.ALIGNMENT_CENTER
	column.add_child(bet_row)
	actions_row = HBoxContainer.new()
	actions_row.alignment = BoxContainer.ALIGNMENT_CENTER
	column.add_child(actions_row)
	column.add_child(_ui_label("JETONS VIRTUELS  ·  7 PLACES  ·  PLUSIEURS CASES POSSIBLES", 10, Color("9b9e87")))
	error_label = _ui_label("", 15, Color("f0b09c"))
	error_label.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	error_label.position -= Vector2(300, 60)
	error_label.size = Vector2(600, 100)
	error_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(error_label)
	login = PanelContainer.new()
	login.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	login.position -= Vector2(220, 110)
	login.size = Vector2(440, 220)
	login.add_theme_stylebox_override("panel", _style_panel(Color("0a1912"), GOLD))
	ui.add_child(login)
	var login_column := VBoxContainer.new()
	login_column.add_theme_constant_override("separation", 14)
	login.add_child(login_column)
	login_column.add_child(_ui_label("Bienvenue à La Table 21", 22, GOLD))
	login_column.add_child(_ui_label("Votre place au casino vous attend", 14))
	pseudo_input = LineEdit.new()
	pseudo_input.placeholder_text = "Votre pseudo"
	pseudo_input.max_length = 16
	pseudo_input.custom_minimum_size.y = 44
	pseudo_input.text_submitted.connect(func(_value): _join())
	login_column.add_child(pseudo_input)
	login_column.add_child(_button("ENTRER DANS LE SALON", _join, 200))
	login_column.add_child(_ui_label("Le jeu utilise uniquement des jetons virtuels", 11, Color("a5a88f")))
	_refresh_ui()

func mute_button_update() -> void:
	var buttons := get_tree().root.find_children("SoundToggle", "Button", true, false)
	for button in buttons: button.text = "Son : OFF" if muted else "Son : ON"

func _refresh_motion_button() -> void:
	var buttons := get_tree().root.find_children("MotionToggle", "Button", true, false)
	for button in buttons: button.text = "Animations : OFF" if reduced_motion else "Animations : ON"

func _join() -> void:
	login.hide()
	phase_label.text = "Connexion au salon…"
	net.connect_player(pseudo_input.text)

func _on_connection(value: bool) -> void:
	connected = value
	status_label.text = "●  CONNECTÉ" if value else "○  RECONNEXION…"
	_refresh_ui()

func _on_player(value: Dictionary) -> void:
	player = value
	balance_label.text = "%s  ·  %s JETONS" % [player.get("pseudo", ""), int(player.get("balance", 0))]
	_refresh_ui()

func _my_seats() -> Array:
	return table.get("seats", []).filter(func(seat): return seat.get("playerId") == player.get("id", "missing"))

func _on_table(value: Dictionary) -> void:
	table = value
	var mine := _my_seats()
	var new_view := selected_seat
	if not mine.is_empty():
		if seat_request > 0 and mine.any(func(seat): return int(seat.seatNumber) == seat_request):
			new_view = seat_request
			seat_request = 0
		elif not mine.any(func(seat): return int(seat.seatNumber) == selected_seat):
			new_view = int(mine[0].seatNumber)
		if new_view != selected_seat or not seated:
			selected_seat = new_view
			seated = true
			_move_camera()
	elif seated:
		seated = false
		_move_camera()
	_sync_scene()
	_refresh_ui()
	has_initial_state = true

func _select_seat(number: int) -> void:
	if demo_mode: return
	var seat = table.get("seats", []).filter(func(item): return int(item.seatNumber) == number)
	if seat.is_empty(): return
	if seat[0].get("playerId") == player.get("id"):
		selected_seat = number
		selected_bet_case = number
		_move_camera()
		_refresh_ui()
	elif seat[0].get("status") == "empty" and connected:
		seat_request = number
		selected_bet_case = number
		net.send_event("sit", {"seatNumber": number})

func _move_camera() -> void:
	if camera_tween: camera_tween.kill()
	var angle := _seat_angle(selected_seat) * .7
	var width := get_viewport().get_visible_rect().size.x
	var height := get_viewport().get_visible_rect().size.y
	var portrait := width < height
	var distance := 8.8 if portrait else 3.4 if seated else 5.55
	var destination := Vector3(sin(angle) * distance, 2.1 if seated else 3.1, cos(angle) * distance)
	var target := Vector3(0, 1.2, -.35)
	for number in seat_chairs:
		for mesh in seat_chairs[number]:
			mesh.visible = not (seated and number == selected_seat)
	var target_transform := Transform3D(Basis(), destination).looking_at(target)
	camera_tween = create_tween()
	camera_tween.tween_property(camera, "transform", target_transform, .01 if reduced_motion else .85).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)

func _adapt_view() -> void:
	var size_value := get_window().size
	var new_compact := size_value.x < size_value.y
	compact = new_compact
	get_window().content_scale_size = Vector2i(540, 960) if compact else Vector2i(1440, 900)
	if status_row:
		status_row.get_child(0).visible = not compact
		for button in status_row.get_children():
			if button is Button:
				button.add_theme_font_size_override("font_size", 11 if compact else 14)
	if camera:
		_move_camera()
	if seat_bar:
		_refresh_ui()

func _clear_row(row: HBoxContainer) -> void:
	for child in row.get_children():
		row.remove_child(child)
		child.queue_free()

func _refresh_ui() -> void:
	if not seat_bar: return
	_clear_row(seat_bar)
	_clear_row(bet_row)
	_clear_row(actions_row)
	var phase := str(table.get("phase", "idle"))
	var open := phase == "idle" or phase == "betting"
	phase_label.text = str(PHASES.get(phase, "Bienvenue")) + (" · Manche %s" % int(table.get("roundNumber", 0)))
	var mine := _my_seats()
	guidance.text = "Choisissez une place libre pour vous asseoir" if mine.is_empty() else "Votre place : %s · Ajoutez une case libre si vous le souhaitez" % selected_seat
	if not connected and not demo_mode: guidance.text = "Connexion au serveur… Les actions sont suspendues"
	for seat in table.get("seats", []):
		var number := int(seat.seatNumber)
		var is_mine: bool = seat.get("playerId") == player.get("id", "missing")
		var empty: bool = seat.get("status") == "empty"
		var button := _button(("%s\n%s" if compact else "%s · %s") % [number, "VOUS" if is_mine else "LIBRE" if empty else "PRISE"], _select_seat.bind(number), 56 if compact else 96)
		button.add_theme_font_size_override("font_size", 10 if compact else 14)
		button.disabled = not connected or (not is_mine and (not empty or not open))
		if is_mine and number == selected_seat:
			button.add_theme_stylebox_override("normal", _style_panel(Color("35432a"), GOLD))
		seat_bar.add_child(button)
	if open and not mine.is_empty():
		var bet_seat = mine.filter(func(seat): return int(seat.seatNumber) == selected_bet_case)
		if bet_seat.is_empty(): bet_seat = [mine[0]]
		selected_bet_case = int(bet_seat[0].seatNumber)
		var seat: Dictionary = bet_seat[0]
		bet_row.add_child(_ui_label("CASE %s" % selected_bet_case, 13, GOLD))
		var hands: Array = seat.get("hands", [])
		if not hands.is_empty():
			bet_row.add_child(_ui_label("Mise : %s" % int(hands[0].bet), 14))
			var clear := _button("ANNULER", func(): net.send_event("clearBet", {"seatNumber": selected_bet_case}))
			clear.disabled = not connected
			bet_row.add_child(clear)
		else:
			for amount in [100, 200, 300, 400, 500]:
				var bet_button := _button(str(amount), _bet.bind(selected_bet_case, amount), 50 if compact else 65)
				bet_button.disabled = not connected or int(player.get("balance", 0)) < amount
				bet_row.add_child(bet_button)
		var leave := _button("QUITTER" if compact else "QUITTER LA CASE", func(): net.send_event("leaveSeat", {"seatNumber": selected_bet_case}), 85 if compact else 145)
		leave.disabled = not connected
		bet_row.add_child(leave)
	active_case = int(table.get("activeSeat", 0)) if table.get("activeSeat") != null else 0
	if phase == "player_turns" and active_case > 0:
		var active = mine.filter(func(seat): return int(seat.seatNumber) == active_case)
		if not active.is_empty():
			guidance.text = "À VOUS DE JOUER · CASE %s" % active_case
			var hand: Dictionary = active[0].hands[int(table.get("activeHandIndex", 0))]
			for entry in [["TIRER", "hit"], ["RESTER", "stand"], ["DOUBLER", "double"], ["SÉPARER", "split"]]:
				var button := _button(entry[0], _action.bind(entry[1]), 100 if compact else 120)
				button.disabled = not connected
				if entry[1] == "double": button.disabled = button.disabled or hand.cards.size() != 2 or hand.doubled or int(player.get("balance", 0)) < int(hand.bet)
				if entry[1] == "split": button.disabled = button.disabled or hand.cards.size() != 2 or hand.isSplit or int(player.get("balance", 0)) < int(hand.bet)
				if entry[1] == "split" and hand.cards.size() == 2: button.disabled = button.disabled or hand.cards[0].rank != hand.cards[1].rank
				actions_row.add_child(button)

func _bet(number: int, amount: int) -> void:
	net.send_event("placeBet", {"seatNumber": number, "amount": amount})

func _action(type: String) -> void:
	net.send_event("action", {"seatNumber": active_case, "handIndex": int(table.get("activeHandIndex", 0)), "type": type})

func _show_error(message: String) -> void:
	error_label.text = message
	error_until = elapsed + 4.0

func _on_deal(payload: Dictionary) -> void:
	animated_cards[str(payload.card.id)] = true
	var target: Vector3 = _seat_position(int(payload.seatNumber)) if str(payload.seatNumber) != "dealer" else Vector3(0, 1.16, -.8)
	if arm_tween: arm_tween.kill()
	arm_tween = create_tween()
	if not reduced_motion:
		arm_tween.tween_property(dealer_arm, "rotation", Vector3(.17, clampf(target.x * -.08, -.4, .4), -.1), .14)
		arm_tween.tween_property(dealer_arm, "rotation", Vector3.ZERO, .3)
	_play_sound(false)

func _sync_scene() -> void:
	var live_cards: Dictionary = {}
	var live_chips: Dictionary = {}
	var live_totals: Dictionary = {}
	for seat in table.get("seats", []):
		var number := int(seat.seatNumber)
		var own: bool = seat.get("playerId") == player.get("id", "missing")
		var empty: bool = seat.get("status") == "empty"
		var label: Label3D = seat_labels[number]
		var total_text := ""
		var hands: Array = seat.get("hands", [])
		for hand_index in hands.size():
			var hand: Dictionary = hands[hand_index]
			var pos := _seat_position(number) + Vector3((hand_index - (hands.size() - 1) / 2.0) * .85, .025, -.32)
			_sync_hand(hand.get("cards", []), pos, live_cards, false)
			if not hand.get("cards", []).is_empty():
				_sync_total("seat-%s-%s" % [number, hand_index], _hand_total(hand.cards), pos + Vector3(0, .16, -.34), live_totals)
			var chip_id := "%s-%s" % [number, hand_index]
			var bet_amount := int(hand.get("bet", 0))
			if bet_amount > 0:
				live_chips[chip_id] = true
				if not chips.has(chip_id) or chips[chip_id].get_meta("amount") != bet_amount:
					if chips.has(chip_id): chips[chip_id].queue_free()
					chips[chip_id] = _create_chip(bet_amount, pos + Vector3(0, .02, .4), has_initial_state)
			if hand.get("result") != null:
				total_text += " · " + {"win": "GAGNÉ", "lose": "PERDU", "push": "ÉGALITÉ", "blackjack": "BLACKJACK", "bust": "DÉPASSÉ"}.get(str(hand.result), "")
		label.text = "%s · %s%s" % [number, "LIBRE" if empty else "VOUS" if own else str(seat.get("pseudo", "")), total_text]
		label.modulate = GOLD if own or empty else Color("b8bda9")
		seat_rings[number].material_override = _material(GOLD if own else Color("687553") if empty else Color("454f40"), .4)
	var dealer: Dictionary = table.get("dealer", {})
	_sync_hand(dealer.get("cards", []), Vector3(-.12, 1.14, -.8), live_cards, not dealer.get("holeCardRevealed", false))
	var visible_dealer: Array = []
	for index in dealer.get("cards", []).size():
		if index != 1 or dealer.get("holeCardRevealed", false):
			visible_dealer.append(dealer.cards[index])
	if not visible_dealer.is_empty():
		_sync_total("dealer", _hand_total(visible_dealer), Vector3(-.12, 1.35, -1.19), live_totals, dealer.get("cards", []).size() > visible_dealer.size())
	for id in hand_totals.keys():
		if not live_totals.has(id):
			hand_totals[id].queue_free()
			hand_totals.erase(id)
	for id in cards.keys():
		if not live_cards.has(id):
			cards[id].queue_free()
			cards.erase(id)
	for id in chips.keys():
		if not live_chips.has(id):
			chips[id].queue_free()
			chips.erase(id)
	animated_cards.clear()

func _hand_total(hand_cards: Array) -> int:
	var total := 0
	var aces := 0
	for card in hand_cards:
		var rank := str(card.get("rank", "0"))
		if rank == "A":
			aces += 1
			total += 11
		elif rank in ["J", "Q", "K"]: total += 10
		else: total += int(rank)
	while total > 21 and aces > 0:
		total -= 10
		aces -= 1
	return total

func _sync_total(id: String, total: int, at: Vector3, live: Dictionary, hidden_card := false) -> void:
	live[id] = true
	if not hand_totals.has(id):
		var label := _label_3d("", at, 56)
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.pixel_size = .0034
		label.outline_size = 14
		label.outline_modulate = Color("071510")
		label.alpha_cut = Label3D.ALPHA_CUT_DISABLED
		hand_totals[id] = label
	var label: Label3D = hand_totals[id]
	label.position = at
	label.text = str(total) + (" + ?" if hidden_card else "")
	label.modulate = Color("f08c86") if total > 21 else Color("fff1c7")

func _sync_hand(hand_cards: Array, origin: Vector3, live: Dictionary, hide_second: bool) -> void:
	# Reveal both values on a normal two-card hand. Longer hands fan more
	# tightly to stay within their case, preserving the corner index.
	var count := hand_cards.size()
	var spacing := minf(.44, .66 / maxf(1, count - 1))
	for index in count:
		var card: Dictionary = hand_cards[index]
		var id := str(card.id)
		live[id] = true
		var destination := origin + Vector3((index - (count - 1) / 2.0) * spacing, index * .012, index * .015)
		var hidden := hide_second and index == 1
		if not cards.has(id):
			cards[id] = _create_card(card, destination, hidden, animated_cards.has(id))
		elif cards[id].get_meta("hidden", false) != hidden:
			cards[id].set_meta("hidden", hidden)
			cards[id].get_node("Face").visible = not hidden
			var flip := create_tween()
			flip.tween_property(cards[id], "rotation:z", TAU, .01 if reduced_motion else .4)
		elif not cards[id].get_meta("flying", false):
			cards[id].position = destination

func _card_ink(parent: Node3D, text_value: String, at: Vector3, size_value: int, color: Color) -> void:
	var label := _label_3d(text_value, Vector3.ZERO, size_value, color)
	remove_child(label)
	parent.add_child(label)
	label.position = at
	label.pixel_size = .0025
	label.rotation_degrees.x = -90

func _create_card(card: Dictionary, destination: Vector3, hidden: bool, animate: bool) -> Node3D:
	var root := Node3D.new()
	root.name = "Card_" + str(card.id).replace("-", "_")
	root.set_meta("hidden", hidden)
	add_child(root)
	_box(Vector3(.40, .012, .56), Vector3.ZERO, _material(Color("fffdf4"), 0, .85), root)
	var back := _box(Vector3(.38, .001, .54), Vector3(0, -.007, 0), _material(Color("732638")), root)
	back.name = "Back"
	var face := Node3D.new()
	face.name = "Face"
	face.visible = not hidden
	root.add_child(face)
	var suit := str(card.get("suit", "spades"))
	var glyph: String = {"spades": "♠", "hearts": "♥", "diamonds": "♦", "clubs": "♣"}.get(suit, "♠")
	var ink := Color("a00e2b") if suit in ["hearts", "diamonds"] else Color("09111a")
	var rank := str(card.get("rank", "A"))
	_card_ink(face, rank, Vector3(-.12, .009, -.177), 50, ink)
	_card_ink(face, glyph, Vector3(-.12, .009, -.068), 35, ink)
	_card_ink(face, glyph, Vector3(.055, .010, .05), 96, ink)
	_card_ink(face, rank, Vector3(.13, .009, .188), 35, ink)
	if hidden: root.rotation_degrees.z = 180
	root.position = destination
	if animate and not reduced_motion:
		root.set_meta("flying", true)
		var from := Vector3(.25, 1.25, -1.42)
		root.position = from
		var tween := create_tween()
		tween.tween_method(func(t: float): root.position = from.lerp(destination, t) + Vector3.UP * sin(t * PI) * .22; root.rotation.y = (1.0 - t) * -.8, 0.0, 1.0, .4)
		tween.tween_callback(func(): root.set_meta("flying", false))
	return root

func _create_chip(amount: int, destination: Vector3, animate: bool) -> Node3D:
	var root := Node3D.new()
	root.set_meta("amount", amount)
	add_child(root)
	var color: Color = {100: Color("b83243"), 200: Color("2e609e"), 300: Color("26805b"), 400: Color("353932"), 500: Color("744698")}.get(amount, GOLD)
	var count := clampi(int(ceil(amount / 100.0)), 1, 6)
	for index in count:
		_cylinder(.13, .028, Vector3(0, index * .03, 0), _material(color, .05), root)
		var stripe := TorusMesh.new()
		stripe.inner_radius = .095
		stripe.outer_radius = .105
		stripe.rings = 32
		stripe.ring_segments = 6
		_mesh(stripe, _material(CREAM), Vector3(0, index * .03 + .015, 0), root)
	var label := _label_3d(str(amount), Vector3.ZERO, 38, CREAM)
	remove_child(label)
	root.add_child(label)
	label.position = Vector3(0, count * .03, 0)
	label.pixel_size = .002
	label.rotation_degrees.x = -90
	root.position = destination
	if animate and not reduced_motion:
		var from := destination + Vector3(0, .6, 1.0)
		root.position = from
		var tween := create_tween()
		tween.tween_property(root, "position", destination, .42).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
		_play_sound(true)
	return root

func _play_sound(chip: bool) -> void:
	if muted: return
	var audio := AudioStreamWAV.new()
	audio.format = AudioStreamWAV.FORMAT_16_BITS
	audio.mix_rate = 22050
	var frames := 1500 if chip else 2500
	var data := PackedByteArray()
	data.resize(frames * 2)
	for frame in frames:
		var t := float(frame) / 22050.0
		var envelope := exp(-t * (90.0 if chip else 50.0))
		var value := sin(t * TAU * (1800.0 if chip else 540.0)) * .25 + sin(t * TAU * 4213.0) * .1
		data.encode_s16(frame * 2, int(value * envelope * 12000))
	audio.data = data
	sound_player.stream = audio
	sound_player.play()

func _on_results(results: Array) -> void:
	var mine: Array = _my_seats().map(func(seat): return int(seat.seatNumber))
	var profit := 0
	var played := false
	for result in results:
		if int(result.seatNumber) in mine:
			profit += int(result.payout) - int(result.bet)
			played = true
	if played:
		_show_error("Résultat de vos cases : %s%s jetons" % ["+" if profit > 0 else "", profit])
		_play_sound(profit > 0)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var from := camera.project_ray_origin(event.position)
		var to := from + camera.project_ray_normal(event.position) * 100
		var hit := get_world_3d().direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(from, to))
		if not hit.is_empty() and hit.collider.has_meta("seat"):
			_select_seat(int(hit.collider.get_meta("seat")))

func _process(delta: float) -> void:
	elapsed += delta
	if dealer_body and not reduced_motion: dealer_body.position.y = sin(elapsed * 1.4) * .008
	if error_label and elapsed > error_until: error_label.text = ""
	if timer_label:
		var deadline = table.get("turnDeadline")
		if deadline != null:
			var remaining := maxi(0, int(ceil(float(deadline) / 1000.0 - Time.get_unix_time_from_system())))
			timer_label.text = "%s s" % remaining
		else: timer_label.text = ""

func _start_demo() -> void:
	login.hide()
	connected = true
	player = {"id": "demo-player", "pseudo": "APERÇU 3D", "balance": 2700}
	_on_player(player)
	var seats: Array = []
	for number in range(1, 8):
		seats.append({"seatNumber": number, "playerId": "demo-player" if number in [3, 4] else null, "pseudo": "APERÇU" if number in [3, 4] else null, "status": "playing" if number in [3, 4] else "empty", "hands": [{"bet": 100 if number == 3 else 200, "cards": [{"id": "demo-%s-a" % number, "rank": "A", "suit": "spades"}, {"id": "demo-%s-b" % number, "rank": "K" if number == 3 else "7", "suit": "hearts"}], "result": null, "doubled": false, "isSplit": false}] if number in [3, 4] else []})
	seat_request = 4
	_on_table({"phase": "dealing", "roundNumber": 1, "seats": seats, "dealer": {"cards": [{"id": "demo-dealer", "rank": "9", "suit": "diamonds"}], "holeCardRevealed": false}, "activeSeat": null, "turnDeadline": null})
	status_label.text = "APERÇU LOCAL · SANS SERVEUR"
