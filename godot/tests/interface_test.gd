extends SceneTree
func _initialize() -> void:
	call_deferred("_run")
func _run() -> void:
	var scene = load("res://scenes/casino.tscn").instantiate()
	root.add_child(scene)
	scene._start_demo()
	root.size = Vector2i(390, 844)
	scene._adapt_view()
	for seat in scene.table.seats:
		if seat.playerId == "demo-player": seat.hands = []; seat.status = "reserved"
	scene.table.phase = "idle"
	scene._on_table(scene.table)
	await process_frame
	await process_frame
	assert(scene.bet_row.get_child_count() == 7, "Case label, five chip choices and exit are available")
	assert(scene.bet_row.get_combined_minimum_size().x <= 504, "Bet choices fit on a phone")
	scene.table.phase = "player_turns"
	scene.table.activeSeat = 4
	scene.table.activeHandIndex = 0
	scene.table.seats[3].hands = [{"cards":[{"id":"ui-a","rank":"8","suit":"clubs"},{"id":"ui-b","rank":"8","suit":"hearts"}],"bet":100,"doubled":false,"isSplit":false,"result":null}]
	scene._on_table(scene.table)
	await process_frame
	assert(scene.actions_row.get_child_count() == 4, "Four player decisions are present")
	assert(scene.actions_row.get_combined_minimum_size().x <= 504, "Player commands fit on a phone")
	for button in scene.actions_row.get_children(): assert(not button.disabled, "A legal pair and sufficient balance enable all decisions")
	assert(not scene.seat_rings[4].visible and scene.seat_rings[1].visible, "Occupied cases are free of circles while free cases remain marked")
	print("GODOT INTERFACE: chip choices, legal actions, phone fit and occupied-circle visibility passed")
	scene.queue_free()
	await process_frame
	quit(0)
