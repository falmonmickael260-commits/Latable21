extends SceneTree
## Integration test against npm run dev. Exercise the real Godot WebSocket
## transport with two players, multiple cases, a full round and refund isolation.

const Network = preload("res://scripts/casino_network.gd")
var first
var second
var errors: Array = []
var deals := 0

func _initialize() -> void:
	call_deferred("_run")

func _wait_for(predicate: Callable, timeout := 8.0) -> bool:
	var start := Time.get_ticks_msec()
	while Time.get_ticks_msec() - start < timeout * 1000:
		if predicate.call(): return true
		await create_timer(.05).timeout
	return false

func _expect(value: bool, message: String) -> void:
	if not value:
		push_error("FAIL: " + message)
		first.close()
		second.close()
		quit(1)
		assert(false, message)
	print("PASS: " + message)

func _run() -> void:
	first = Network.new()
	second = Network.new()
	first.stopped = true
	second.stopped = true
	root.add_child(first)
	root.add_child(second)
	first.device_token = ""
	second.device_token = ""
	first.card_dealt.connect(func(_payload): deals += 1)
	first.connect_player("GodotTestA")
	second.connect_player("GodotTestB")
	_expect(await _wait_for(func(): return first.identified and second.identified and not first.table.is_empty()), "both Godot clients identify via Socket.IO WebSocket")
	_expect(first.player.id != second.player.id, "two clients have distinct identities")
	var available: Array = first.table.seats.filter(func(seat): return seat.status == "empty")
	_expect(available.size() >= 2, "two free cases are available for the integration test")
	var a := int(available[0].seatNumber)
	var b := int(available[1].seatNumber)
	first.send_event("sit", {"seatNumber": a})
	first.send_event("sit", {"seatNumber": b})
	_expect(await _wait_for(func(): return first.table.seats[a - 1].playerId == first.player.id and first.table.seats[b - 1].playerId == first.player.id), "one player reserves two free cases")
	second.error_received.connect(func(message): errors.append(message))
	second.send_event("sit", {"seatNumber": a})
	_expect(await _wait_for(func(): return not errors.is_empty()), "another player cannot take an occupied case")
	first.send_event("placeBet", {"seatNumber": a, "amount": 100})
	first.send_event("placeBet", {"seatNumber": b, "amount": 200})
	_expect(await _wait_for(func(): return int(first.player.balance) == 2700), "independent case bets debit exactly 300 virtual chips")
	_expect(await _wait_for(func(): return str(first.table.phase) == "player_turns" or str(first.table.phase).begins_with("dealer"), 30), "server distributes cards and opens the round")
	_expect(deals >= 5, "Godot receives individual card-animation events")
	var start := Time.get_ticks_msec()
	while Time.get_ticks_msec() - start < 15000:
		if str(first.table.phase) == "player_turns" and first.table.activeSeat != null:
			first.send_event("action", {"seatNumber": int(first.table.activeSeat), "handIndex": int(first.table.activeHandIndex), "type": "stand"})
		if str(first.table.phase) == "payout": break
		await create_timer(.1).timeout
	_expect(str(first.table.phase) == "payout", "a complete two-case round reaches settlement")
	_expect(await _wait_for(func(): return str(first.table.phase) == "idle"), "next round resets without losing the reserved cases")
	_expect(first.table.dealer.cards.is_empty(), "dealer cards are cleared after the round")
	first.send_event("leaveSeat", {"seatNumber": a})
	first.send_event("leaveSeat", {"seatNumber": b})
	_expect(await _wait_for(func(): return first.table.seats[a - 1].status == "empty" and first.table.seats[b - 1].status == "empty"), "leaving after settlement makes cases available again")
	first.close()
	second.close()
	print("GODOT NETWORK INTEGRATION: ALL CHECKS PASSED")
	quit(0)
