extends SceneTree
func _initialize() -> void:
	call_deferred("_run")
func _run() -> void:
	var scene = load("res://scenes/casino.tscn").instantiate()
	root.add_child(scene)
	assert(scene.dealer_head.get_child_count() == 1, "The detailed dealer model is instantiated")
	var rest: Vector3 = scene.dealer_arm.position
	scene._on_deal({"seatNumber":4,"card":{"id":"pose-test"}})
	scene.arm_tween.pause()
	scene.arm_tween.custom_step(.10)
	scene._update_dealer_arm()
	assert(scene.dealer_arm.position.distance_to(rest) > .1, "The hand reaches to pick up a card")
	assert(absf(scene.dealer_upper_arm.scale.y-.69)<.001, "The upper arm retains its anatomical length")
	assert(absf(scene.dealer_forearm.scale.y-.62)<.001, "The forearm retains its anatomical length")
	scene.arm_tween.custom_step(.6)
	scene._update_dealer_arm()
	assert(scene.dealer_arm.position.distance_to(rest) < .01, "The dealer returns to the resting pose")
	scene.muted = true
	scene.mute_button_update()
	assert(scene.ambience_player.stream_paused, "Muting also pauses the room ambience")
	scene.reduced_motion = true
	scene._on_deal({"seatNumber":4,"card":{"id":"still-test"}})
	await process_frame
	assert(scene.dealer_arm.position.distance_to(rest)<.01, "Reduced motion keeps the dealer still")
	print("GODOT ATMOSPHERE: detailed model, articulated pickup, stable arm lengths, return pose, mute and reduced motion passed")
	scene.ambience_player.stop()
	scene.sound_player.stop()
	scene.arm_tween.kill()
	scene.queue_free()
	await process_frame
	await process_frame
	await create_timer(.08).timeout
	quit(0)
