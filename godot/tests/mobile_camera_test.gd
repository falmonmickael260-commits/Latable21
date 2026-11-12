extends SceneTree
func _initialize() -> void:
	call_deferred("_run")
func _width_css(scene: Node3D, card: Node3D, css_width: float) -> float:
	var bounds: AABB = card.get_node("Stock").mesh.get_aabb()
	var left := INF
	var right := -INF
	for index in range(8):
		var point: Vector3 = card.get_node("Stock").global_transform*bounds.get_endpoint(index)
		var screen: Vector2 = scene.camera.unproject_position(point)
		left = minf(left,screen.x)
		right = maxf(right,screen.x)
	return (right-left)/root.get_visible_rect().size.x*css_width
func _run() -> void:
	var scene = load("res://scenes/casino.tscn").instantiate()
	root.add_child(scene)
	scene.reduced_motion = true
	scene._start_demo()
	root.size = Vector2i(374,650)
	scene._adapt_view()
	await process_frame
	scene.camera_tween.custom_step(2)
	await process_frame
	var own: Node3D = scene.cards["demo-4-a"]
	var dealer: Node3D = scene.cards["demo-dealer"]
	var own_width := _width_css(scene,own,374)
	var dealer_width := _width_css(scene,dealer,374)
	print("Mobile card widths in CSS pixels: own=%s dealer=%s" % [own_width,dealer_width])
	assert(own_width >= 60, "The player's cards must be readable at phone size")
	assert(dealer_width >= 45, "The dealer's card must be readable at phone size")
	for card in [own,dealer]:
		assert(not scene.camera.is_position_behind(card.global_position), "Both hands are in front of the phone camera")
		var screen: Vector2 = scene.camera.unproject_position(card.global_position)
		var size := root.get_visible_rect().size
		assert(screen.x > 0 and screen.x < size.x and screen.y > 0 and screen.y < size.y*.72, "Cards stay visible above the phone controls")
	# A multi-case player's active turn controls the close camera.
	scene.table.phase = "player_turns"
	scene.table.activeSeat = 3
	scene._on_table(scene.table)
	assert(scene.mobile_camera_seat == 3, "The portrait camera follows the player's active case")
	for number in [1,7]:
		var hand: Dictionary = scene.table.seats[3].hands[0].duplicate(true)
		for index in hand.cards.size(): hand.cards[index].id = "edge-%s-%s" % [number,index]
		scene.table.seats[number-1].playerId = "demo-player"
		scene.table.seats[number-1].hands = [hand]
		scene.table.activeSeat = number
		scene._on_table(scene.table)
		scene.camera_tween.custom_step(2)
		await process_frame
		assert(scene.mobile_camera_seat == number, "Side cases can be focused on a phone")
		for card in [scene.cards["edge-%s-0" % number],dealer]:
			var screen: Vector2 = scene.camera.unproject_position(card.global_position)
			var size := root.get_visible_rect().size
			assert(screen.x > 0 and screen.x < size.x and screen.y > 0 and screen.y < size.y*.72, "Side-case cards and the dealer remain in view")
	var split: Dictionary = scene.table.seats[6].hands[0].duplicate(true)
	for index in split.cards.size(): split.cards[index].id = "phone-split-%s" % index
	scene.table.seats[6].hands.append(split)
	for hand_index in [0,1]:
		scene.table.activeHandIndex = hand_index
		scene._on_table(scene.table)
		scene.camera_tween.custom_step(2)
		await process_frame
		assert(scene.mobile_camera_hand == hand_index, "The phone camera follows each split hand")
		var id := "edge-7-0" if hand_index == 0 else "phone-split-0"
		var screen: Vector2 = scene.camera.unproject_position(scene.cards[id].global_position)
		var size := root.get_visible_rect().size
		assert(screen.x > 0 and screen.x < size.x and screen.y > 0 and screen.y < size.y*.72, "The active split hand stays visible")
		for data in scene.table.seats[6].hands[hand_index].cards:
			var stock: MeshInstance3D = scene.cards[data.id].get_node("Stock")
			for index in range(8):
				var corner: Vector2 = scene.camera.unproject_position(stock.global_transform*stock.mesh.get_aabb().get_endpoint(index))
				assert(corner.x > 0 and corner.x < size.x and corner.y > 0 and corner.y < size.y*.76, "The complete active split cards fit on the phone")
	scene.ambience_player.stop()
	scene.sound_player.stop()
	scene.queue_free()
	await process_frame
	await process_frame
	await create_timer(.1).timeout
	print("GODOT MOBILE CAMERA: readable projected cards, visible dealer hand and active-case focus passed")
	quit(0)
