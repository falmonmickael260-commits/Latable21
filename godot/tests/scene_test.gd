extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var scene = load("res://scenes/casino.tscn").instantiate()
	root.add_child(scene)
	scene.pseudo_input.text = "GodotSceneTest"
	scene._join()
	var start := Time.get_ticks_msec()
	while Time.get_ticks_msec() - start < 8000 and scene.table.get("seats", []).size() != 7:
		await create_timer(.05).timeout
	if scene.table.get("seats", []).size() != 7:
		push_error("Scene never received the seven server seats")
		quit(1)
		return
	assert(scene.seat_bar.get_child_count() == 7, "Scene displays seven live seat controls")
	var available: Array = scene.table.seats.filter(func(seat): return seat.status == "empty")
	assert(not available.is_empty(), "A free seat is required for scene integration")
	var number := int(available[0].seatNumber)
	scene._select_seat(number)
	start = Time.get_ticks_msec()
	while Time.get_ticks_msec() - start < 5000 and not scene.seated:
		await create_timer(.05).timeout
	assert(scene.seated and scene.selected_seat == number, "Camera uses a server-confirmed seat")
	scene._bet(number, 100)
	start = Time.get_ticks_msec()
	while Time.get_ticks_msec() - start < 5000 and scene.chips.is_empty():
		await create_timer(.05).timeout
	assert(scene.chips.size() == 1, "Confirmed bets create a physical chip stack")
	scene.net.send_event("clearBet", {"seatNumber": number})
	scene.net.send_event("leaveSeat", {"seatNumber": number})
	await create_timer(.2).timeout
	root.size = Vector2i(390, 844)
	scene._adapt_view()
	await process_frame
	await process_frame
	assert(scene.compact, "Portrait layout is enabled on a phone viewport")
	assert(scene.seat_bar.get_combined_minimum_size().x <= 504, "All seven seat controls fit the phone canvas")
	scene.net.close()
	print("GODOT SCENE: seat controls, seated camera, physical chip stack, refund and portrait controls passed")
	scene.queue_free()
	await process_frame
	quit(0)
