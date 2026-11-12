extends Node3D
## A real 3D casino scene. Geometry, UI and animation are independent of the
## authoritative blackjack engine. No external assets or paid services required.

const BrandArt = preload("res://scripts/brand_art.gd")
const CardArt = preload("res://scripts/card_art.gd")
const CARD_TILT = deg_to_rad(22.0)
const NetworkScript = preload("res://scripts/casino_network.gd")
const FONT = preload("res://assets/table-font.ttf")
const FELT_FONT = preload("res://assets/felt-serif.ttf")
const GOLD = Color("bca477")
const CREAM = Color("efe5cd")
const FELT_SURFACE_Y = 1.10
const CHIP_RADIUS = .096
const CHIP_HEIGHT = .018
const PHASES = {"idle": "Faites vos jeux", "betting": "Les mises sont ouvertes", "dealing": "Distribution des cartes", "player_turns": "Tour des joueurs", "dealer_reveal": "Le croupier révèle son jeu", "dealer_turns": "Le croupier joue", "payout": "Résultats de la manche"}

var net: CasinoNetwork
var camera: Camera3D
var dealer_arm: Node3D
var dealer_body: Node3D
var dealer_head: Node3D
var dealer_upper_arm: MeshInstance3D
var dealer_forearm: MeshInstance3D
var dealer_cuff: MeshInstance3D
var dealer_hand: Node3D
var dealer_look := 0.0
var ambience_player: AudioStreamPlayer
var last_collect_sound := -10.0
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
var mobile_camera_seat := 0
var mobile_camera_hand := 0
var mobile_view: TextureRect
var mobile_viewport: SubViewport
var ui_root: Control
var embedded_mode := false
var status_row: HBoxContainer
var chip_button_textures: Dictionary = {}
var card_face_textures: Dictionary = {}

func _ready() -> void:
	if OS.has_feature("web"):
		embedded_mode = bool(JavaScriptBridge.eval("new URLSearchParams(location.search).get('embedded') === '1'"))
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
	sound_player.volume_db = -14
	sound_player.max_polyphony = 6
	add_child(sound_player)
	ambience_player = AudioStreamPlayer.new()
	var ambience: AudioStreamWAV = load("res://assets/sounds/salon-ambience.wav")
	ambience.loop_mode = AudioStreamWAV.LOOP_FORWARD
	ambience.loop_end = int(ambience.get_length()*ambience.mix_rate)
	ambience_player.stream = ambience
	ambience_player.volume_db = -30
	add_child(ambience_player)
	ambience_player.play()
	if demo_mode:
		_start_demo()
	else:
		for argument in OS.get_cmdline_user_args():
			if argument.begins_with("--pseudo="):
				pseudo_input.text = argument.trim_prefix("--pseudo=")
				_join()
	if embedded_mode and not demo_mode and net.stopped and not net.device_token.is_empty():
		_join()
	get_viewport().size_changed.connect(_adapt_view)
	_adapt_view()

func _exit_tree() -> void:
	var viewport := get_viewport()
	if viewport and mobile_view: viewport.disable_3d = false

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
	environment.ambient_light_color = Color("c8c7bd")
	environment.ambient_light_energy = .29
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
	key.light_angular_distance = 4.0
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
	fill.light_color = Color("dce3db")
	fill.light_energy = .4
	fill.omni_range = 8
	add_child(fill)
	var wall := _material(Color("141d18"), .05, .85)
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
	_build_casino_identity()

	camera = Camera3D.new()
	camera.position = Vector3(0, 3.7, 7.7)
	camera.fov = 68
	camera.current = true
	add_child(camera)
	camera.look_at(Vector3(0, 1.25, -.75))

func _wall_print(texture: Texture2D, size_value: Vector2, at: Vector3, material_color := Color.WHITE) -> MeshInstance3D:
	var material := _material(material_color,.0,.9)
	material.albedo_texture = texture
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	material.alpha_scissor_threshold = .2
	var plane := QuadMesh.new()
	plane.size = size_value
	var print_mesh := _mesh(plane,material,at)
	print_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return print_mesh

func _build_casino_identity() -> void:
	var brass := _material(Color("b99a60"),.72,.29)
	var dark_wood := _table_material("wood")
	var emblem := BrandArt.logo()
	# The emblem sits forward of its wall, with a warm light washing the panel behind it.
	var silhouette := _wall_print(emblem,Vector2(3.3,2.97),Vector3(0,3.99,-5.77),Color("463718"))
	silhouette.name = "LogoReliefShadow"
	var logo := _wall_print(emblem,Vector2(3.24,2.916),Vector3(0,4.0,-5.71))
	logo.name = "LaTable21IlluminatedCrest"
	var logo_material: StandardMaterial3D = logo.material_override
	logo_material.emission_enabled = true
	logo_material.emission_texture = emblem
	logo_material.emission = Color("dcc080")
	logo_material.emission_energy_multiplier = .12
	var halo := OmniLight3D.new()
	halo.position = Vector3(0,4.13,-5.38)
	halo.light_color = Color("ffdc94")
	halo.light_energy = .45
	halo.omni_range = 2.1
	add_child(halo)
	var artwork := load("res://assets/art/casino-diptych.png") as Texture2D
	for index in range(2):
		var x := -3.0 if index == 0 else 3.0
		var center := Vector3(x,3.12,-5.67)
		var backing := _box(Vector3(1.85,2.40,.085),center,dark_wood)
		backing.name = "CasinoPainting%s" % index
		# Stepped antique-gold frame, linen mount and inset oil painting.
		_box(Vector3(1.78,2.33,.035),center+Vector3(0,0,.05),brass)
		_box(Vector3(1.68,2.23,.02),center+Vector3(0,0,.075),_material(Color("20281f")))
		_box(Vector3(1.56,2.11,.012),center+Vector3(0,0,.09),_material(Color("b9ac8b"),0,.95))
		var painting := _wall_print(artwork,Vector2(1.42,1.94),center+Vector3(0,0,.103))
		painting.material_override.uv1_scale = Vector3(.5,1,1)
		painting.material_override.uv1_offset = Vector3(index*.5,0,0)
		painting.name = "CasinoOilPainting"
		var lamp_y := center.y+1.31
		_box(Vector3(.60,.035,.075),Vector3(x,lamp_y,-5.43),brass)
		for offset in [-.17,.17]: _segment(Vector3(x+offset,lamp_y,-5.7),Vector3(x+offset,lamp_y,-5.43),.012,brass)
		var picture_light := OmniLight3D.new()
		picture_light.position = Vector3(x,lamp_y-.12,-5.21)
		picture_light.light_color = Color("ffe4b4")
		picture_light.light_energy = .65
		picture_light.omni_range = 2.1
		add_child(picture_light)

func _table_material(kind: String) -> StandardMaterial3D:
	var colors := {"felt": [Color("123f31"), Color("194b3a")], "wood": [Color("271a13"), Color("513526")], "leather": [Color("15221d"), Color("24332b")]}
	var material := _material(colors[kind][0], .0, .94 if kind == "felt" else .34 if kind == "wood" else .57)
	var noise := FastNoiseLite.new()
	noise.seed = 2107
	noise.frequency = .045 if kind == "wood" else .22
	noise.fractal_octaves = 3
	var grain := NoiseTexture2D.new()
	grain.width = 512
	grain.height = 512
	grain.seamless = true
	grain.noise = noise
	var gradient := Gradient.new()
	gradient.set_color(0, colors[kind][0])
	gradient.set_color(1, colors[kind][1])
	grain.color_ramp = gradient
	material.albedo_color = Color.WHITE
	material.albedo_texture = grain
	material.uv1_scale = Vector3(1.5, 14, 1) if kind == "wood" else Vector3(48, 48, 1) if kind == "felt" else Vector3(16, 16, 1)
	var detail := NoiseTexture2D.new()
	detail.width = 256
	detail.height = 256
	detail.seamless = true
	detail.noise = noise
	detail.as_normal_map = true
	material.normal_enabled = true
	material.normal_texture = detail
	material.normal_scale = .11 if kind == "leather" else .035
	return material

func _rail_stitching(radius: float, height: float) -> void:
	# One mesh for hundreds of short, inset stitches along the oval upholstery.
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for index in range(420):
		var a := TAU * index / 420.0
		var b := a + TAU / 420.0 * .48
		var from := Vector3(sin(a) * radius * 1.06, height, cos(a) * radius * .70)
		var to := Vector3(sin(b) * radius * 1.06, height, cos(b) * radius * .70)
		var side := (to-from).normalized().cross(Vector3.UP) * .0018
		for vertex in [from-side,to-side,from+side,from+side,to-side,to+side]:
			surface.set_normal(Vector3.UP)
			surface.add_vertex(vertex)
	var stitches := _mesh(surface.commit(), _material(Color("8b8066"), 0, .85), Vector3.ZERO)
	stitches.name = "RailStitching"
	stitches.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func _build_table() -> void:
	var gold := _material(Color("a38b5f"), .72, .31)
	var wood := _table_material("wood")
	var leather := _table_material("leather")
	var base := _cylinder(2.65, .24, Vector3(0, .87, 0), wood)
	base.name = "WalnutApron"
	base.scale = Vector3(1.06, 1, .70)
	# Recessed lower edge, slender brass reveal and a rounded upholstered rail.
	var lower_edge := _torus(2.61, .026, Vector3(0, .757, 0), wood)
	lower_edge.scale = Vector3(1.06, .65, .70)
	var rim := _cylinder(2.65, .012, Vector3(0, 1.002, 0), gold)
	rim.scale = Vector3(1.06, 1, .70)
	var cushion := _torus(2.52, .123, Vector3(0, 1.091, 0), leather)
	cushion.name = "LeatherArmrest"
	cushion.scale = Vector3(1.06, .72, .70)
	_rail_stitching(2.475, 1.174)
	_rail_stitching(2.565, 1.174)
	var felt := _cylinder(2.43, .03, Vector3(0, FELT_SURFACE_Y - .015, 0), _table_material("felt"))
	felt.name = "TableFelt"
	felt.scale = Vector3(1.06, 1, .70)
	# A proper double pedestal, with timber columns and low brass foot plates.
	for x in [-1.25, 1.25]:
		var foot := _cylinder(.53, .075, Vector3(x, .075, 0), wood)
		foot.scale.z = .8
		var foot_trim := _cylinder(.535, .012, Vector3(x, .115, 0), gold)
		foot_trim.scale.z = .8
		_cylinder(.26, .63, Vector3(x, .44, 0), wood)
		_cylinder(.29, .035, Vector3(x, .73, 0), gold)
	var foot_rail := _torus(2.26, .025, Vector3(0, .26, 0), gold)
	foot_rail.scale = Vector3(1.06, 1, .70)
	for x in [-1.25, 1.25]:
		for side in [-1, 1]:
			_segment(Vector3(x, .26, 0), Vector3(x, .26, side * 1.35), .019, gold)
	var plaque := _box(Vector3(.62, .105, .015), Vector3(0, .875, 1.858), gold)
	plaque.name = "MakerPlaque"
	var signature := _label_3d("LA TABLE 21", Vector3(0, .875, 1.868), 32, Color("20251c"))
	signature.font = FELT_FONT
	signature.pixel_size = .0021
	# Quiet perimeter printing frames the playing field without competing with cards.
	var perimeter: Array[Vector3] = []
	for step in range(193):
		var angle := TAU * step / 192.0
		perimeter.append(Vector3(sin(angle) * 2.375 * 1.06, 1.104, cos(angle) * 2.375 * .70))
	_printed_curve(perimeter, .003, Color("807e60"))

	var printed_material := _material(Color.WHITE,0,1)
	printed_material.albedo_texture = BrandArt.felt()
	printed_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	printed_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	printed_material.alpha_scissor_threshold = .2
	var printed_plane := PlaneMesh.new()
	printed_plane.size = Vector2(5.1516,3.402)
	var felt_print := _mesh(printed_plane,printed_material,Vector3(0,1.106,0))
	felt_print.name = "EuropeanFeltPrint"
	felt_print.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

	var dealer_line: Array[Vector3] = []
	for step in range(61):
		var angle := deg_to_rad(lerpf(-58, 58, step / 60.0))
		dealer_line.append(Vector3(sin(angle) * 1.77, 1.105, -.54 + 1.18 * (1 - cos(angle))))
	_printed_curve(dealer_line, .009, Color("a79e7c"))
	for number in range(1, 8):
		var pos := _seat_position(number)
		var outline: Array[Vector3] = []
		for step in range(65):
			var angle := TAU * step / 64.0
			outline.append(pos + Vector3(cos(angle) * .265, -.02, sin(angle) * .265))
		seat_rings[number] = _printed_curve(outline, .012, Color("b6ab86"))
		var seat_angle := _seat_angle(number)
		var number_offset := Vector3(sin(seat_angle) * .13 + cos(seat_angle) * .20, -.016, cos(seat_angle) * .13 - sin(seat_angle) * .20)
		var seat_label := _felt_text(str(number), pos + number_offset, 42, .0024)
		seat_label.scale.y = 1.8
		seat_labels[number] = seat_label
		var body := StaticBody3D.new()
		body.position = pos
		body.set_meta("seat", number)
		var hitbox := CollisionShape3D.new()
		var shape := CylinderShape3D.new()
		shape.radius = .31
		shape.height = .12
		hitbox.shape = shape
		body.add_child(hitbox)
		add_child(body)
		var chair_root := _build_chair(Vector3(pos.x*1.3,.55,pos.z*1.5),_seat_angle(number),leather,wood,gold)
		seat_chairs[number] = [chair_root]

	# The card shoe and chip tray are physical props, separate from the dealer.
	var shoe_root := Node3D.new()
	shoe_root.name = "DealerCardShoe"
	shoe_root.position = Vector3(.85, FELT_SURFACE_Y, -1.40)
	shoe_root.rotation_degrees.y = -15
	add_child(shoe_root)
	_box(Vector3(.44, .035, .62), Vector3(0, .018, 0), wood, shoe_root)
	var shoe_cover := _material(Color("27372e"), .15, .22)
	for side in [-1, 1]:
		_box(Vector3(.018, .19, .54), Vector3(side * .21, .11, -.03), shoe_cover, shoe_root)
	var shoe_lid := _box(Vector3(.44, .025, .42), Vector3(0, .215, -.11), shoe_cover, shoe_root)
	shoe_lid.rotation_degrees.x = -12
	for index in range(10):
		var deck := _box(Vector3(.255, .006, .35), Vector3(0, .05 + index * .009, -.04), _material(CREAM), shoe_root)
		deck.rotation_degrees.x = -12
	_box(Vector3(.28, .007, .09), Vector3(0, .045, .245), gold, shoe_root)
	# Five separated wells hold neat stacks of casino chips.
	_box(Vector3(1.13, .045, .40), Vector3(-1.2, 1.132, -1.25), wood)
	for column in range(5):
		var center_x := -1.62 + column * .21
		_box(Vector3(.19, .012, .34), Vector3(center_x, 1.163, -1.25), _material(Color("09140f")))
		for layer in range(5):
			var coin := _chip_coin([100, 200, 300, 400, 500][column], layer == 4)
			add_child(coin)
			coin.position = Vector3(center_x, 1.172 + layer * CHIP_HEIGHT, -1.25)
	var discard := _box(Vector3(.38,.07,.52),Vector3(-1.86,1.14,-.92),wood)
	discard.name = "DiscardTray"
	for index in range(5): _box(Vector3(.30,.0028,.42),Vector3(-1.86,1.178+index*.003,-.92),_material(Color("732638")))

func _cushion(size_value: Vector3, material: Material, parent: Node3D) -> MeshInstance3D:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var profile := [Vector2(-.5,.86),Vector2(-.34,1),Vector2(.25,1),Vector2(.5,.86)]
	var rings: Array = []
	for row in profile:
		var ring: Array[Vector3] = []
		for index in range(65):
			var angle := TAU*index/64.0
			var x: float = signf(cos(angle))*pow(absf(cos(angle)),.38)*size_value.x*.5*row.y
			var z: float = signf(sin(angle))*pow(absf(sin(angle)),.38)*size_value.z*.5*row.y
			ring.append(Vector3(x,row.x*size_value.y,z))
		rings.append(ring)
	for row in range(rings.size()-1):
		for index in range(64):
			for point in [rings[row][index],rings[row+1][index],rings[row][index+1],rings[row][index+1],rings[row+1][index],rings[row+1][index+1]]: surface.add_vertex(point)
	for side in [0,3]:
		for index in range(64):
			var points: Array = [Vector3(0,profile[side].x*size_value.y,0),rings[side][index],rings[side][index+1]]
			if side == 3: points.reverse()
			for point in points: surface.add_vertex(point)
	surface.index()
	surface.generate_normals()
	return _mesh(surface.commit(),material,Vector3.ZERO,parent)

func _cushion_seam(cushion: Node3D, width: float, depth: float, height: float) -> void:
	var points: Array[Vector3] = []
	for index in range(129):
		var angle := TAU*index/128.0
		points.append(Vector3(signf(cos(angle))*pow(absf(cos(angle)),.38)*width*.43,height*.5+.0004,signf(sin(angle))*pow(absf(sin(angle)),.38)*depth*.43))
	var seam := _printed_curve(points,.0017,Color("73735a"))
	remove_child(seam)
	cushion.add_child(seam)

func _build_chair(at: Vector3, angle: float, leather: Material, wood: Material, gold: Material) -> Node3D:
	var chair := Node3D.new()
	chair.name = "UpholsteredChair"
	chair.position = at
	chair.rotation.y = angle
	add_child(chair)
	var base := _cushion(Vector3(.72,.05,.66),wood,chair)
	base.position.y = -.075
	var seat := _cushion(Vector3(.68,.13,.62),leather,chair)
	_cushion_seam(seat,.68,.62,.13)
	var shell := _cushion(Vector3(.74,.07,.69),wood,chair)
	shell.position = Vector3(0,.40,.34)
	shell.rotation_degrees.x = -84
	var back := _cushion(Vector3(.68,.13,.63),leather,chair)
	back.position = Vector3(0,.40,.285)
	back.rotation_degrees.x = -84
	_cushion_seam(back,.68,.63,.13)
	for side in [-1,1]: _segment(Vector3(side*.28,-.08,.27),Vector3(side*.28,.43,.34),.024,wood,chair)
	_cylinder(.045,.44,Vector3(0,-.31,0),gold,chair)
	var foot := _cylinder(.24,.035,Vector3(0,-.53,0),gold,chair)
	foot.scale.z = .85
	return chair

func _felt_text(text_value: String, at: Vector3, size_value: int, pixel_size_value: float) -> Label3D:
	var label := _label_3d(text_value, at, size_value, Color("c0b18c"))
	label.font = FELT_FONT
	label.pixel_size = pixel_size_value
	label.rotation_degrees.x = -90
	label.scale.y = 1.5
	label.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return label

func _felt_ink(color: Color) -> StandardMaterial3D:
	var ink := _material(color, 0, .98)
	ink.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	return ink

func _printed_curve(points: Array[Vector3], width: float, color: Color) -> MeshInstance3D:
	# Flat ink on the felt, with no metal thickness, relief or cast shadow.
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for index in points.size() - 1:
		var from := points[index]
		var to := points[index + 1]
		var side := (to - from).normalized().cross(Vector3.UP) * width / 2
		for vertex in [from - side, to - side, from + side, from + side, to - side, to + side]:
			surface.set_normal(Vector3.UP)
			surface.add_vertex(vertex)
	var ink := _felt_ink(color)
	ink.cull_mode = BaseMaterial3D.CULL_DISABLED
	var line := _mesh(surface.commit(), ink, Vector3.ZERO)
	line.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return line

func _seat_angle(number: int) -> float:
	return deg_to_rad((number - 4) * 23.0)

func _seat_position(number: int) -> Vector3:
	var angle := _seat_angle(number)
	return Vector3(sin(angle) * 2.25, 1.125, cos(angle) * 1.27 + .14)

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
	_cylinder(.095,.25,Vector3(0,2.43,0),skin,dealer_body)
	dealer_head = Node3D.new()
	dealer_head.position = Vector3(0,2.69,0)
	dealer_body.add_child(dealer_head)
	var head_model = load("res://assets/dealer/dealer-head.glb").instantiate()
	head_model.scale = Vector3.ONE*1.3
	head_model.position = Vector3(0,-2.76*1.3,0)
	dealer_head.add_child(head_model)

	for y in [1.79,1.6]: _sphere(.015,Vector3(.035,y,.24),_material(GOLD,.6),dealer_body)
	_box(Vector3(.14,.045,.01),Vector3(-.29,2.07,.207),_material(GOLD,.6),dealer_body)
	_segment(Vector3(-.38,2.14,.02),Vector3(-.53,1.6,.4),.12,suit,dealer_body)
	_segment(Vector3(-.53,1.6,.4),Vector3(-.26,1.21,.86),.095,suit,dealer_body)
	var resting_hand := _sphere(.09,Vector3(-.26,1.235,.91),skin,dealer_body)
	resting_hand.scale = Vector3(.85,.35,1.1)
	for finger in range(4): _segment(Vector3(-.31+finger*.03,1.225,.96),Vector3(-.31+finger*.03,1.22,1.06),.012,skin,dealer_body)
	dealer_arm = Node3D.new()
	dealer_arm.position = Vector3(.24,1.28,.88)
	dealer_body.add_child(dealer_arm)
	dealer_upper_arm = _cylinder(.105,1,Vector3.ZERO,suit,dealer_body)
	dealer_forearm = _cylinder(.083,1,Vector3.ZERO,suit,dealer_body)
	dealer_cuff = _cylinder(.084,.055,Vector3.ZERO,shirt,dealer_body)
	dealer_hand = Node3D.new()
	dealer_body.add_child(dealer_hand)
	var palm := _sphere(.075,Vector3(0,0,.035),skin,dealer_hand)
	palm.scale = Vector3(1,.33,1.15)
	for finger in range(4):
		var x := -.046+finger*.031
		_segment(Vector3(x,-.004,.087),Vector3(x,-.009,.14),.012,skin,dealer_hand)
		_segment(Vector3(x,-.009,.14),Vector3(x,-.018,.163),.010,skin,dealer_hand)
	_segment(Vector3(-.066,-.008,.035),Vector3(-.089,-.019,.08),.016,skin,dealer_hand)
	_update_dealer_arm()

func _pose_segment(mesh: MeshInstance3D, from: Vector3, to: Vector3) -> void:
	mesh.position = (from+to)*.5
	mesh.quaternion = Quaternion(Vector3.UP,(to-from).normalized())
	mesh.scale.y = from.distance_to(to)

func _update_dealer_arm() -> void:
	if not dealer_arm: return
	var shoulder := Vector3(.38,2.14,.02)
	var direction: Vector3 = dealer_arm.position-shoulder
	var distance := clampf(direction.length(),.2,1.30)
	direction = direction.normalized()
	var along := (.69*.69-.62*.62+distance*distance)/(2*distance)
	var height := sqrt(maxf(0,.69*.69-along*along))
	var bend := (Vector3.RIGHT-direction*direction.dot(Vector3.RIGHT)).normalized()
	var elbow := shoulder+direction*along+bend*height
	var wrist := shoulder+direction*distance
	_pose_segment(dealer_upper_arm,shoulder,elbow)
	_pose_segment(dealer_forearm,elbow,wrist)
	dealer_cuff.position = wrist+(elbow-wrist).normalized()*.025
	dealer_cuff.quaternion = Quaternion(Vector3.UP,(wrist-elbow).normalized())
	dealer_hand.position = wrist
	dealer_hand.rotation = Vector3(.03,-dealer_look*.5,0)

func _style_panel(color := Color("101d18"), border := Color("665d41")) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = border
	style.set_border_width_all(1)
	style.set_corner_radius_all(8)
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

func _chip_button_texture(amount: int) -> Texture2D:
	if chip_button_textures.has(amount): return chip_button_textures[amount]
	var color := "#" + _chip_color(amount).to_html(false)
	var svg := '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><circle cx="64" cy="64" r="59" fill="%s" stroke="#e2d8bf" stroke-width="2"/>' % color
	for index in range(8):
		var a := TAU * index / 8.0 - .12
		var b := TAU * index / 8.0 + .12
		var points: Array[Vector2] = [Vector2(cos(a),sin(a))*47, Vector2(cos(a),sin(a))*59, Vector2(cos(b),sin(b))*59, Vector2(cos(b),sin(b))*47]
		svg += '<polygon points="'
		for point in points: svg += '%s,%s ' % [64+point.x,64+point.y]
		svg += '" fill="#e2d8bf"/>'
	svg += '<circle cx="64" cy="64" r="42" fill="none" stroke="#e2d8bf" stroke-width="1"/><circle cx="64" cy="64" r="36" fill="#f0ead8"/></svg>'
	var image := Image.new()
	image.load_svg_from_string(svg)
	var texture := ImageTexture.create_from_image(image)
	chip_button_textures[amount] = texture
	return texture

func _bet_chip_button(amount: int, callback: Callable) -> Button:
	var chip_size := 60 if compact else 52
	var button := _button(str(amount), callback, chip_size)
	button.custom_minimum_size = Vector2(chip_size, chip_size)
	button.tooltip_text = "Miser %s jetons" % amount
	button.add_theme_font_size_override("font_size", 16 if compact else 14)
	button.add_theme_color_override("font_color", Color("16251c"))
	button.add_theme_color_override("font_hover_color", Color("16251c"))
	button.add_theme_color_override("font_pressed_color", Color("16251c"))
	for state in ["normal", "hover", "pressed", "disabled"]:
		var style := StyleBoxTexture.new()
		style.texture = _chip_button_texture(amount)
		style.content_margin_left = 0
		style.content_margin_right = 0
		style.content_margin_top = 0
		style.content_margin_bottom = 0
		if state == "hover": style.modulate_color = Color(1.1,1.1,1.1)
		if state == "pressed": style.modulate_color = Color(.85,.85,.85)
		if state == "disabled": style.modulate_color = Color(.4,.45,.4,.5)
		button.add_theme_stylebox_override(state, style)
	return button

func _game_action_button(caption: String, action_value: String) -> Button:
	var symbols := {"hit": "+", "stand": "—", "double": "×2", "split": "◇"}
	var button := _button(caption + "  " + str(symbols[action_value]), _action.bind(action_value), 100 if compact else 122)
	button.custom_minimum_size.y = 62 if compact else 54
	button.add_theme_font_size_override("font_size", 16 if compact else 14)
	button.tooltip_text = {"hit":"Recevoir une carte", "stand":"Conserver cette main", "double":"Doubler la mise et recevoir une carte", "split":"Séparer deux cartes de même rang"}[action_value]
	for state in ["normal", "hover", "pressed", "disabled"]:
		var background := Color("14231c")
		var border := Color("7a704e")
		if action_value == "hit": background = Color("234f3d"); border = Color("79947a")
		if action_value == "stand": background = Color("bea36c"); border = Color("d8c28f")
		if state == "hover": background = background.lightened(.09)
		if state == "pressed": background = background.darkened(.12)
		if state == "disabled": background = Color("101b15"); border = Color("344333")
		var style := _style_panel(background, border)
		style.content_margin_left = 12
		style.content_margin_right = 12
		style.content_margin_top = 12
		style.content_margin_bottom = 12
		button.add_theme_stylebox_override(state, style)
	button.add_theme_color_override("font_color", Color("16231a") if action_value == "stand" else Color("e8dfc6"))
	button.add_theme_color_override("font_disabled_color", Color("596c58"))
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
	ui_root = ui
	mobile_view = TextureRect.new()
	mobile_view.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	mobile_view.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	mobile_view.stretch_mode = TextureRect.STRETCH_SCALE
	mobile_view.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mobile_view.visible = false
	ui.add_child(mobile_view)
	mobile_viewport = SubViewport.new()
	mobile_viewport.world_3d = get_world_3d()
	mobile_viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED
	mobile_viewport.msaa_3d = Viewport.MSAA_4X
	mobile_view.add_child(mobile_viewport)
	mobile_view.texture = mobile_viewport.get_texture()
	ui.resized.connect(_update_mobile_view_rect)
	var top := MarginContainer.new()
	top.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	top.add_theme_constant_override("margin_left", 24)
	top.add_theme_constant_override("margin_right", 24)
	top.add_theme_constant_override("margin_top", 18)
	ui.add_child(top)
	top.visible = not embedded_mode
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
	title.position = Vector2(-200, 14 if embedded_mode else 70)
	title.size = Vector2(400, 90)
	title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(title)
	title.add_child(_ui_label("LA TABLE 21", 28, GOLD))
	title.get_child(0).visible = not embedded_mode
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
	controls_panel.resized.connect(_update_mobile_view_rect)
	controls_panel.add_theme_stylebox_override("panel", _style_panel(Color(.025, .055, .04, .94)))
	bottom.add_child(controls_panel)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	controls_panel.add_child(column)
	guidance = _ui_label("Choisissez une place libre pour vous asseoir", 14, CREAM)
	guidance.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
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
	var footer_row := HBoxContainer.new()
	column.add_child(footer_row)
	var footer_text := _ui_label("JETONS VIRTUELS  ·  BLACKJACK 3:2", 9, Color("8c9a82"))
	footer_text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	footer_row.add_child(footer_text)
	if embedded_mode:
		# Keep the wall emblem unobstructed; round status belongs with the controls.
		title.remove_child(phase_label)
		title.remove_child(timer_label)
		footer_text.hide()
		footer_row.add_child(phase_label)
		footer_row.move_child(phase_label,0)
		phase_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		phase_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
		phase_label.clip_text = true
		phase_label.add_theme_font_size_override("font_size",11)
		footer_row.add_child(timer_label)
		title.hide()
		for settings_button in [mute_button, motion_button]:
			top_row.remove_child(settings_button)
			footer_row.add_child(settings_button)
			settings_button.custom_minimum_size = Vector2(55, 25)
			settings_button.add_theme_font_size_override("font_size", 9)
			var quiet := _style_panel(Color(0,0,0,0), Color("62735d55"))
			quiet.content_margin_left = 8
			quiet.content_margin_right = 8
			quiet.content_margin_top = 4
			quiet.content_margin_bottom = 4
			settings_button.add_theme_stylebox_override("normal", quiet)
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
	if ambience_player: ambience_player.stream_paused = muted
	if muted and sound_player: sound_player.stop()
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
	if compact and (mobile_camera_seat != _mobile_focus_number() or mobile_camera_hand != _mobile_focus_hand_index(_mobile_focus_number())): _move_camera()
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

func _mobile_focus_number() -> int:
	var mine := _my_seats()
	var active := int(table.get("activeSeat",0)) if table.get("activeSeat") != null else 0
	if active > 0 and mine.any(func(seat): return int(seat.seatNumber) == active): return active
	if selected_bet_case > 0 and mine.any(func(seat): return int(seat.seatNumber) == selected_bet_case): return selected_bet_case
	return selected_seat

func _mobile_focus_hand_index(number: int) -> int:
	if table.get("activeSeat") != null and int(table.activeSeat) == number: return int(table.get("activeHandIndex",0))
	return 0

func _move_camera() -> void:
	if camera_tween: camera_tween.kill()
	var angle := _seat_angle(selected_seat)*.7
	var distance := 4.2 if seated else 5.55
	var destination := Vector3(sin(angle)*distance,2.70 if seated else 3.25,cos(angle)*distance)
	var target := Vector3(0,1.28,-.25)
	camera.fov = 68
	if compact:
		# Keep the same seated pitch, but fit the complete rail on portrait screens.
		# A stable central view also keeps other occupied cases visible during turns.
		mobile_camera_seat = _mobile_focus_number()
		mobile_camera_hand = _mobile_focus_hand_index(mobile_camera_seat)
		target = Vector3(0,1.70,.15)
		var view_direction := Vector3(0,1.35,3.75).normalized()
		var view_basis := Basis.looking_at(-view_direction)
		var viewport_size := Vector2(mobile_viewport.size)
		var half_height := tan(deg_to_rad(camera.fov*.5))*.92
		var half_width := half_height*viewport_size.x/maxf(1,viewport_size.y)
		var fitted_distance := 3.75
		for step in range(64):
			var rail_angle := TAU*step/64.0
			var rail_point := Vector3(sin(rail_angle)*2.82,1.09,cos(rail_angle)*1.88)
			var local := view_basis.inverse()*(rail_point-target)
			fitted_distance = maxf(fitted_distance,local.z+absf(local.x)/half_width)
			fitted_distance = maxf(fitted_distance,local.z+absf(local.y)/half_height)
		destination = target+view_direction*fitted_distance
	else: mobile_camera_seat = 0
	for number in seat_chairs:
		for mesh in seat_chairs[number]:
			mesh.visible = not compact and not (seated and number == selected_seat)
	var target_transform := Transform3D(Basis(),destination).looking_at(target)
	camera_tween = create_tween()
	camera_tween.tween_property(camera,"transform",target_transform,.01 if reduced_motion else .65).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)

func _update_mobile_view_rect() -> void:
	if not mobile_view or not ui_root or not controls_panel: return
	var top := 0.0 if embedded_mode else 120.0
	var bottom := controls_panel.get_global_rect().position.y-10.0
	if bottom < top+200: bottom = ui_root.size.y*.75
	mobile_view.position = Vector2(0,top)
	mobile_view.size = Vector2(ui_root.size.x,maxf(200,bottom-top))
	# Render at the actual phone pixel density, avoiding a blurred enlarged viewport texture.
	var raster_scale := clampf(float(get_window().size.x)/maxf(1,ui_root.size.x),.75,2.5)
	var render_size := Vector2i(mobile_view.size*raster_scale)
	if mobile_viewport.size != render_size:
		mobile_viewport.size = render_size
		if compact and camera: _move_camera()

func _adapt_view() -> void:
	var size_value := get_window().size
	var new_compact := size_value.x < size_value.y
	compact = new_compact
	get_window().content_scale_size = Vector2i(540, 960) if compact else Vector2i(1100, 760) if embedded_mode else Vector2i(1440, 900)
	if status_row:
		status_row.get_child(0).visible = not compact
		for button in status_row.get_children():
			if button is Button:
				button.add_theme_font_size_override("font_size", 11 if compact else 14)
	if camera and mobile_view:
		mobile_view.visible = compact
		mobile_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS if compact else SubViewport.UPDATE_DISABLED
		var camera_parent: Node = mobile_viewport if compact else self
		if camera.get_parent() != camera_parent: camera.reparent(camera_parent,false)
		camera.make_current()
		get_viewport().disable_3d = compact
		_update_mobile_view_rect()
		_move_camera()
		if not table.is_empty(): _sync_scene()
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
	guidance.text = "Choisissez une place libre pour vous asseoir" if mine.is_empty() else ("Votre case : %s · Plusieurs cases possibles" if compact else "Votre place : %s · Ajoutez une case libre si vous le souhaitez") % selected_seat
	if not connected and not demo_mode: guidance.text = "Connexion au serveur… Les actions sont suspendues"
	for seat in table.get("seats", []):
		var number := int(seat.seatNumber)
		var is_mine: bool = seat.get("playerId") == player.get("id", "missing")
		var empty: bool = seat.get("status") == "empty"
		var button := _button(("%s\n%s" if compact else "%s · %s") % [number, "VOUS" if is_mine else "LIBRE" if empty else "PRISE"], _select_seat.bind(number), 56 if compact else 96)
		button.add_theme_font_size_override("font_size", 10 if compact else 14)
		button.tooltip_text = "Case %s · %s" % [number, "Libre" if empty else str(seat.get("pseudo", ""))]
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
				var bet_button := _bet_chip_button(amount, _bet.bind(selected_bet_case, amount))
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
			for entry in [["TIRER", "hit"], ["RESTER", "stand"], ["DOUBLE", "double"], ["SPLIT", "split"]]:
				var button := _game_action_button(entry[0], entry[1])
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
	if not reduced_motion:
		arm_tween = create_tween()
		dealer_look = clampf(target.x*.085,-.16,.16)
		arm_tween.tween_property(dealer_arm,"position",Vector3(.85,1.38,1.0),.10).set_trans(Tween.TRANS_SINE)
		arm_tween.tween_property(dealer_arm,"position",Vector3(.18+target.x*.08,1.25,1.07),.17).set_trans(Tween.TRANS_SINE)
		arm_tween.tween_property(dealer_arm,"position",Vector3(.24,1.28,.88),.15).set_trans(Tween.TRANS_SINE)

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
		var hands: Array = seat.get("hands", [])
		for hand_index in hands.size():
			var hand: Dictionary = hands[hand_index]
			var pos := _seat_position(number) + Vector3((hand_index - (hands.size() - 1) / 2.0) * .85, .025, -.32)
			_sync_hand(hand.get("cards", []), pos, live_cards, false,1.20 if compact else 1.0)
			if not hand.get("cards", []).is_empty():
				_sync_total("seat-%s-%s" % [number, hand_index], _hand_total(hand.cards), Vector3(pos.x, FELT_SURFACE_Y + (.38 if compact else .25), pos.z - .25), live_totals)
			var chip_id := "%s-%s" % [number, hand_index]
			var bet_amount := int(hand.get("bet", 0))
			if bet_amount > 0:
				live_chips[chip_id] = true
				if not chips.has(chip_id) or chips[chip_id].get_meta("amount") != bet_amount:
					if chips.has(chip_id): chips[chip_id].queue_free()
					chips[chip_id] = _create_chip(bet_amount, pos + Vector3(0, .02, .46 if compact else .4), has_initial_state)
		# Seat numbers are ink on the felt; ownership stays in the controls.
		label.text = str(number)
		label.modulate = Color("ded0aa")
		seat_rings[number].visible = empty
		seat_rings[number].material_override = _felt_ink(Color("c9b98f") if own else Color("a5a180") if empty else Color("797b6b"))

	var dealer: Dictionary = table.get("dealer", {})
	_sync_hand(dealer.get("cards", []), Vector3(-.12, 1.14, -.8), live_cards, not dealer.get("holeCardRevealed", false),1.35 if compact else 1.0)
	var visible_dealer: Array = []
	for index in dealer.get("cards", []).size():
		if index != 1 or dealer.get("holeCardRevealed", false):
			visible_dealer.append(dealer.cards[index])
	if not visible_dealer.is_empty():
		_sync_total("dealer", _hand_total(visible_dealer), Vector3(-.12, FELT_SURFACE_Y + (.40 if compact else .25), -1.12), live_totals, dealer.get("cards", []).size() > visible_dealer.size())
	for id in hand_totals.keys():
		if not live_totals.has(id):
			hand_totals[id].queue_free()
			hand_totals.erase(id)
	for id in cards.keys():
		if not live_cards.has(id):
			var discarded: Node3D = cards[id]
			if not reduced_motion and connected:
				var collect := create_tween().bind_node(discarded)
				collect.tween_property(discarded,"position",Vector3(-1.86,1.20,-.92),.32).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
				collect.tween_callback(discarded.queue_free)
				if elapsed-last_collect_sound > .5: _play_sound(false); last_collect_sound = elapsed
			else: discarded.queue_free()
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
		var label := _label_3d("", at, 42)
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.pixel_size = .0027
		label.outline_size = 3
		label.outline_modulate = Color("071510")
		label.alpha_cut = Label3D.ALPHA_CUT_DISABLED
		hand_totals[id] = label
	var label: Label3D = hand_totals[id]
	label.position = at
	label.pixel_size = .0033 if compact else .0027
	label.text = str(total) + (" + ?" if hidden_card else "")
	label.modulate = Color("f08c86") if total > 21 else Color("fff2d8")

func _sync_hand(hand_cards: Array, origin: Vector3, live: Dictionary, hide_second: bool, display_scale := 1.0) -> void:
	# Reveal both values on a normal two-card hand. Longer hands fan more
	# tightly to stay within their case, preserving the corner index.
	var count := hand_cards.size()
	var spacing := minf(.24 if compact else .285, .46 / maxf(1, count - 1) if compact else .52 / maxf(1,count-1))*display_scale
	for index in count:
		var card: Dictionary = hand_cards[index]
		var id := str(card.id)
		live[id] = true
		var destination := origin + Vector3((index - (count - 1) / 2.0) * spacing, 0, index * .015)
		destination.y = FELT_SURFACE_Y + (sin(CARD_TILT)*.21+cos(CARD_TILT)*.0014)*display_scale + .0005 + index*.0031*display_scale
		var hidden := hide_second and index == 1
		if not cards.has(id):
			cards[id] = _create_card(card, destination, hidden, animated_cards.has(id))
		elif cards[id].get_meta("hidden", false) != hidden:
			cards[id].set_meta("hidden", hidden)
			cards[id].get_node("Face").visible = not hidden
			var flip := create_tween().bind_node(cards[id])
			cards[id].set_meta("flying", true)
			if not reduced_motion: flip.tween_property(cards[id], "position:y", destination.y + .18, .12)
			flip.tween_property(cards[id], "rotation:z", TAU, .01 if reduced_motion else .25)
			flip.tween_property(cards[id], "position", destination, .01 if reduced_motion else .12)
			flip.tween_callback(func(): if is_instance_valid(cards.get(id)): cards[id].set_meta("flying", false))
		elif not cards[id].get_meta("flying", false):
			cards[id].position = destination
		cards[id].scale = Vector3.ONE*display_scale

func _card_stock(parent: Node3D) -> void:
	# A thin rounded card, rather than a rectangular box with sharp corners.
	var outline: Array[Vector2] = []
	for corner in [Vector2(-.136,-.196),Vector2(.136,-.196),Vector2(.136,.196),Vector2(-.136,.196)]:
		var start := -PI if corner.x < 0 and corner.y < 0 else -PI/2 if corner.x > 0 and corner.y < 0 else 0.0 if corner.x > 0 else PI/2
		for step in range(9):
			var angle := start + PI/2 * step/8.0
			outline.append(corner + Vector2(cos(angle),sin(angle)) * .014)
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for index in outline.size():
		var a := outline[index]
		var b := outline[(index+1)%outline.size()]
		for y in [-.0014,.0014]:
			surface.set_normal(Vector3.UP if y > 0 else Vector3.DOWN)
			var points := [Vector3(0,y,0),Vector3(b.x,y,b.y),Vector3(a.x,y,a.y)] if y > 0 else [Vector3(0,y,0),Vector3(a.x,y,a.y),Vector3(b.x,y,b.y)]
			for point in points: surface.add_vertex(point)
		surface.set_normal(Vector3(a.x,0,a.y).normalized())
		for point in [Vector3(a.x,-.0014,a.y),Vector3(b.x,-.0014,b.y),Vector3(a.x,.0014,a.y),Vector3(a.x,.0014,a.y),Vector3(b.x,-.0014,b.y),Vector3(b.x,.0014,b.y)]: surface.add_vertex(point)
	var body := _mesh(surface.commit(), _material(Color("fffdf7"),0,.9),Vector3.ZERO,parent)
	body.name = "Stock"

func _create_card(card: Dictionary, destination: Vector3, hidden: bool, animate: bool) -> Node3D:
	var root := Node3D.new()
	root.name = "Card_" + str(card.id).replace("-", "_")
	root.set_meta("hidden", hidden)
	root.rotation.x = CARD_TILT
	add_child(root)
	_card_stock(root)
	var back := _box(Vector3(.275, .0003, .395), Vector3(0, -.00165, 0), _material(Color("732638")), root)
	back.name = "Back"
	var face := Node3D.new()
	face.name = "Face"
	face.visible = not hidden
	root.add_child(face)
	var suit := str(card.get("suit", "spades"))
	var rank := str(card.get("rank", "A"))
	var key := rank + suit
	if not card_face_textures.has(key):
		if card_face_textures.size() >= 16: card_face_textures.erase(card_face_textures.keys()[0])
		card_face_textures[key] = CardArt.texture(rank,suit)
	var ink := _material(Color.WHITE,0,1)
	ink.albedo_texture = card_face_textures[key]
	ink.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ink.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	ink.alpha_scissor_threshold = .3
	var plane := PlaneMesh.new()
	plane.size = Vector2(.30,.42)
	var print_face := _mesh(plane,ink,Vector3(0,.0017,0),face)
	print_face.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	if hidden: root.rotation_degrees.z = 180
	root.position = destination
	if animate and not reduced_motion:
		root.set_meta("flying", true)
		var from := Vector3(.85, 1.33, -1.40)
		root.position = from
		var tween := create_tween()
		tween.tween_interval(.10)
		tween.tween_method(func(t: float): root.position = from.lerp(destination, t) + Vector3.UP * sin(t * PI) * .12; root.rotation.y = (1.0 - t) * -.6, 0.0, 1.0, .30).set_trans(Tween.TRANS_SINE)
		tween.tween_callback(func(): root.set_meta("flying", false))
	return root

func _chip_color(value: int) -> Color:
	return {100: Color("ac263b"), 200: Color("255b99"), 300: Color("256d50"), 400: Color("272930"), 500: Color("63448a"), 50: Color("aa8646"), 25: Color("256d50"), 10: Color("255b99"), 5: Color("ac263b")}.get(value, Color("65706b"))

func _chip_values(amount: int) -> Array[int]:
	# Each physical chip has a real denomination; a stack must sum to its bet.
	var values: Array[int] = []
	var remaining := amount
	for value in [500, 400, 300, 200, 100, 50, 25, 10, 5, 1]:
		while remaining >= value:
			values.append(value)
			remaining -= value
	return values

func _chip_marks(parent: Node3D, count: int, spread: float, color: Color, face: bool) -> void:
	var edge_radius := CHIP_RADIUS + (.00008 if count == 64 else .00016)
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for mark in count:
		for step in range(3):
			var a := TAU * mark / count + lerpf(-spread / 2, spread / 2, step / 3.0)
			var b := TAU * mark / count + lerpf(-spread / 2, spread / 2, (step + 1) / 3.0)
			var ra := Vector3(cos(a), 0, sin(a))
			var rb := Vector3(cos(b), 0, sin(b))
			var top := Vector3.UP * (CHIP_HEIGHT + .0004)
			if face:
				for vertex in [ra * CHIP_RADIUS * .75 + top, rb * edge_radius + top, ra * edge_radius + top, ra * CHIP_RADIUS * .75 + top, rb * CHIP_RADIUS * .75 + top, rb * edge_radius + top]:
					surface.set_normal(Vector3.UP)
					surface.add_vertex(vertex)
			var low := .002 if face else .003
			var high := CHIP_HEIGHT - (.002 if face else .003)
			for vertex in [ra * edge_radius + Vector3.UP * low, rb * edge_radius + Vector3.UP * high, ra * edge_radius + Vector3.UP * high, ra * edge_radius + Vector3.UP * low, rb * edge_radius + Vector3.UP * low, rb * edge_radius + Vector3.UP * high]:
				surface.set_normal((ra + rb).normalized())
				surface.add_vertex(vertex)
	var material := _material(color, 0, .68)
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	_mesh(surface.commit(), material, Vector3.ZERO, parent)

func _chip_coin(value: int, face := true) -> Node3D:
	var coin := Node3D.new()
	coin.set_meta("denomination", value)
	var color := _chip_color(value)
	var body := _cylinder(CHIP_RADIUS, CHIP_HEIGHT, Vector3(0, CHIP_HEIGHT / 2, 0), _material(color, 0, .65), coin)
	body.name = "ClayBody"
	# Fine edge grooves and eight ivory inserts go through the rim.
	_chip_marks(coin, 64, deg_to_rad(.7), color.darkened(.32), false)
	_chip_marks(coin, 8, deg_to_rad(16), Color("e7dfc9"), face)
	if face:
		_cylinder(.060, .0006, Vector3(0, CHIP_HEIGHT + .0003, 0), _material(Color("f0ead8"), 0, .8), coin)
		for radius in [.062, .072]:
			var ring := TorusMesh.new()
			ring.inner_radius = radius - .0007
			ring.outer_radius = radius + .0007
			ring.rings = 48
			ring.ring_segments = 6
			_mesh(ring, _material(Color("e7dfc9") if radius > .07 else color, 0, .8), Vector3(0, CHIP_HEIGHT + .0007, 0), coin)
		var printed := _label_3d(str(value), Vector3.ZERO, 40, Color("17232a"))
		remove_child(printed)
		coin.add_child(printed)
		printed.position = Vector3(0, CHIP_HEIGHT + .0012, 0)
		printed.font = FELT_FONT
		printed.pixel_size = .00145
		printed.rotation_degrees.x = -90
		printed.scale.y = 1.25
	return coin

func _create_chip(amount: int, destination: Vector3, animate: bool) -> Node3D:
	var root := Node3D.new()
	root.set_meta("amount", amount)
	add_child(root)
	var values := _chip_values(amount)
	for index in values.size():
		var coin := _chip_coin(values[index], index == values.size() - 1)
		coin.name = "Coin%s" % index
		coin.position.y = index * CHIP_HEIGHT
		coin.rotation.y = index * .12
		root.add_child(coin)
	# A small camera-facing amount is readable without enlarging the objects.
	var amount_label := _label_3d(str(amount), Vector3.ZERO, 38, Color("fff2d8"))
	remove_child(amount_label)
	root.add_child(amount_label)
	amount_label.name = "BetAmount"
	amount_label.position = Vector3(-.20, values.size() * CHIP_HEIGHT + .04, .09)
	amount_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	amount_label.pixel_size = .0020
	amount_label.outline_size = 2
	amount_label.outline_modulate = Color("071510")
	amount_label.alpha_cut = Label3D.ALPHA_CUT_DISABLED
	destination.y = FELT_SURFACE_Y + .0004
	root.position = destination
	if animate and not reduced_motion:
		# Slide along the felt; no airborne bounce or gap after landing.
		root.position = destination + Vector3(0, 0, .12)
		var tween := create_tween()
		tween.tween_property(root, "position", destination, .28).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		_play_sound(true)
	return root

func _play_sound(chip: bool) -> void:
	if muted or not sound_player: return
	sound_player.stream = load("res://assets/sounds/clay-chip.wav" if chip else "res://assets/sounds/card-slide.wav")
	sound_player.pitch_scale = randf_range(.96,1.04)
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
		var point: Vector2 = event.position
		if compact and mobile_view:
			var local_event := mobile_view.make_input_local(event)
			point = local_event.position
			if not Rect2(Vector2.ZERO,mobile_view.size).has_point(point): return
			point *= Vector2(mobile_viewport.size)/mobile_view.size
		var from := camera.project_ray_origin(point)
		var to := from + camera.project_ray_normal(point) * 100
		var hit := get_world_3d().direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(from, to))
		if not hit.is_empty() and hit.collider.has_meta("seat"):
			_select_seat(int(hit.collider.get_meta("seat")))

func _process(delta: float) -> void:
	elapsed += delta
	if dealer_body and not reduced_motion:
		dealer_body.position.y = -.1+sin(elapsed*1.4)*.0035
		dealer_look = move_toward(dealer_look,0,delta*.045)
		dealer_head.rotation.y = lerp_angle(dealer_head.rotation.y,dealer_look,delta*4)
		dealer_head.rotation.x = sin(elapsed*.8)*.008
	_update_dealer_arm()
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
