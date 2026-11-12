extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var scene = load("res://scenes/casino.tscn").instantiate()
	root.add_child(scene)
	for texture in [scene.BrandArt.logo(),scene.BrandArt.felt()]:
		assert(texture != null and texture.get_width() > 1000, "Casino identity and table markings are rendered from vector art")
	for suit in ["spades", "hearts", "diamonds", "clubs"]:
		for rank in ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]:
			var texture = scene.CardArt.texture(rank,suit)
			assert(texture.get_width() == 768 and texture.get_height() == 1075, "Every card has a high-resolution face")
			assert(texture.get_image().has_mipmaps(), "Card faces support perspective filtering")
	scene._start_demo()
	assert(scene.cards["demo-3-a"].rotation.x > .3, "Card faces are tilted towards the player")
	assert(scene.hand_totals["seat-3-0"].text == "21", "Blackjack total appears above the first case")
	assert(scene.hand_totals["seat-4-0"].text == "18", "The second case has its own total")
	assert(scene.hand_totals["dealer"].text == "9", "Dealer shows the total of visible cards")
	scene.table.dealer.cards.append({"id": "hidden-test", "rank": "K", "suit": "clubs"})
	scene._sync_scene()
	assert(scene.hand_totals["dealer"].text == "9 + ?", "A hidden card is excluded from the displayed total")
	scene.table.dealer.holeCardRevealed = true
	scene._sync_scene()
	assert(scene.hand_totals["dealer"].text == "19", "Revealing the hole card updates the dealer total")

	var hand: Dictionary = scene.table.seats[3].hands[0]
	hand.cards.append({"id": "soft-ace-test", "rank": "K", "suit": "diamonds"})
	scene._sync_scene()
	assert(scene.hand_totals["seat-4-0"].text == "18", "A soft ace becomes one after drawing a ten")
	hand.cards.append({"id": "bust-test", "rank": "8", "suit": "clubs"})
	scene._sync_scene()
	assert(scene.hand_totals["seat-4-0"].text == "26", "The total updates after another draw")
	assert(scene.hand_totals["seat-4-0"].modulate == Color("f08c86"), "Busted totals are visibly highlighted")

	var split: Dictionary = hand.duplicate(true)
	split.cards = [{"id": "split-a", "rank": "Q", "suit": "clubs"}, {"id": "split-b", "rank": "J", "suit": "spades"}]
	scene.table.seats[3].hands.append(split)
	scene._sync_scene()
	assert(scene.hand_totals["seat-4-1"].text == "20", "Split hands have independent totals")
	assert(scene.hand_totals["seat-4-0"].position != scene.hand_totals["seat-4-1"].position, "Split totals sit over their respective hands")

	for seat in scene.table.seats: seat.hands = []
	scene.table.dealer.cards = []
	scene._sync_scene()
	assert(scene.hand_totals.is_empty(), "Totals disappear when hands are cleared")
	assert(scene.cards.is_empty(), "Cards disappear when hands are cleared")
	print("GODOT CARDS: independent totals, hidden dealer card, soft ace, bust, split and reset passed")
	scene.ambience_player.stop()
	scene.sound_player.stop()
	scene.queue_free()
	await process_frame
	await process_frame
	await create_timer(.10).timeout
	quit(0)
