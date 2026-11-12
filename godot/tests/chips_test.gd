extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var scene = load("res://scenes/casino.tscn").instantiate()
	root.add_child(scene)
	var felt: MeshInstance3D = scene.get_node("TableFelt")
	var felt_top: float = felt.global_position.y + felt.mesh.get_aabb().end.y
	for amount in [100, 150, 200, 300, 400, 500, 600, 1000]:
		var stack: Node3D = scene._create_chip(amount, Vector3(0, 8, .5), false)
		var sum := 0
		var previous_top := felt_top
		for coin in stack.get_children():
			if not coin.has_meta("denomination"): continue
			sum += int(coin.get_meta("denomination"))
			var body: MeshInstance3D = coin.get_node("ClayBody")
			var bounds := body.mesh.get_aabb()
			var bottom: float = body.global_position.y + bounds.position.y
			var top: float = body.global_position.y + bounds.end.y
			assert(bottom >= previous_top - .00001, "Chips do not intersect the felt or each other")
			assert(bottom - previous_top < .001, "There is no visible air gap below a chip")
			previous_top = top
		assert(sum == amount, "Physical chip denominations sum to the displayed bet")
		assert(stack.get_node("BetAmount").text == str(amount), "Each stack has a readable amount")
		stack.queue_free()
	var sliding: Node3D = scene._create_chip(200, Vector3(0, 8, 1), true)
	assert(absf(sliding.position.y - felt_top) < .001, "Placing chips starts on the felt plane")
	await create_timer(.35).timeout
	assert(absf(sliding.position.y - felt_top) < .001, "Placing chips finishes on the felt plane")
	assert(absf(sliding.position.z - 1.0) < .001, "The stack arrives at the intended position")
	scene._start_demo()
	for id in ["demo-3-a", "demo-4-a", "demo-dealer"]:
		var card: Node3D = scene.cards[id]
		var stock: MeshInstance3D = card.get_child(0)
		var bottom := INF
		for index in range(8):
			bottom = minf(bottom, (stock.global_transform * stock.mesh.get_aabb().get_endpoint(index)).y)
		assert(bottom >= felt_top and bottom - felt_top < .001, "Tilted cards touch the felt with their lower edge")
	scene.ambience_player.stop()
	scene.sound_player.stop()
	scene.queue_free()
	await process_frame
	await process_frame
	await create_timer(.10).timeout
	print("GODOT CHIPS: contact with felt, touching stack layers, denomination sums, planar placement and grounded cards passed")
	quit(0)
