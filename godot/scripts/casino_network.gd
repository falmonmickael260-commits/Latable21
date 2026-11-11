class_name CasinoNetwork
extends Node
## Socket.IO v4 default-namespace transport over Engine.IO v4 WebSocket.
## No client outcomes or balances: the existing Node server stays authoritative.

signal table_received(table: Dictionary)
signal player_received(player: Dictionary)
signal card_dealt(payload: Dictionary)
signal round_result(payload: Array)
signal connection_changed(connected: bool)
signal error_received(message: String)

var player: Dictionary = {}
var table: Dictionary = {}
var pseudo := "JOUEUR"
var server_url := "ws://127.0.0.1:3000"
var device_token := ""
var peer := WebSocketPeer.new()
var retry_after := 0.0
var identified := false
var stopped := true
var config := ConfigFile.new()

func _ready() -> void:
	config.load("user://table21.cfg")
	device_token = str(config.get_value("player", "token", ""))
	pseudo = str(config.get_value("player", "pseudo", "JOUEUR"))
	if OS.has_feature("web"):
		# Reuse the existing site's identity on the first Godot launch.
		if device_token.is_empty():
			var browser_token = JavaScriptBridge.eval("localStorage.getItem('bj_device_token')")
			var browser_pseudo = JavaScriptBridge.eval("localStorage.getItem('bj_pseudo')")
			if browser_token != null: device_token = str(browser_token)
			if browser_pseudo != null: pseudo = str(browser_pseudo)
		var location_url = JavaScriptBridge.eval("location.origin")
		if location_url != null:
			server_url = str(location_url).replace("https://", "wss://").replace("http://", "ws://")
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--server="):
			server_url = arg.trim_prefix("--server=").replace("https://", "wss://").replace("http://", "ws://").trim_suffix("/")
		if arg.begins_with("--pseudo="):
			pseudo = arg.trim_prefix("--pseudo=")

func connect_player(name_value: String) -> void:
	pseudo = name_value.strip_edges().left(16)
	if pseudo.is_empty():
		pseudo = "JOUEUR"
	stopped = false
	config.set_value("player", "pseudo", pseudo)
	config.save("user://table21.cfg")
	_connect_socket()

func _connect_socket() -> void:
	identified = false
	peer = WebSocketPeer.new()
	var result := peer.connect_to_url(server_url + "/socket.io/?EIO=4&transport=websocket")
	if result != OK:
		error_received.emit("Serveur inaccessible. Vérifiez son adresse et démarrez npm run dev.")
		retry_after = 3.0

func _process(delta: float) -> void:
	if stopped:
		return
	if retry_after > 0:
		retry_after -= delta
		if retry_after <= 0:
			_connect_socket()
		return
	peer.poll()
	var state := peer.get_ready_state()
	if state == WebSocketPeer.STATE_OPEN:
		while peer.get_available_packet_count() > 0:
			_handle_packet(peer.get_packet().get_string_from_utf8())
	elif state == WebSocketPeer.STATE_CLOSED and not pseudo.is_empty():
		if identified:
			connection_changed.emit(false)
		identified = false
		retry_after = 3.0

func _handle_packet(packet: String) -> void:
	if packet.begins_with("0"):
		peer.send_text("40") # Connect the default Socket.IO namespace.
	elif packet.begins_with("2"):
		peer.send_text("3" + packet.substr(1)) # Engine.IO heartbeat.
	elif packet.begins_with("40"):
		var payload := {"pseudo": pseudo}
		if not device_token.is_empty():
			payload["deviceToken"] = device_token
		send_event("identify", payload)
	elif packet.begins_with("42"):
		var decoded = JSON.parse_string(packet.substr(2))
		if decoded is Array and decoded.size() == 2 and decoded[1] is Dictionary:
			_handle_event(str(decoded[0]), decoded[1])
	elif packet.begins_with("44"):
		error_received.emit("Connexion refusée par le serveur.")

func _handle_event(event: String, payload: Dictionary) -> void:
	match event:
		"identified":
			device_token = str(payload.get("deviceToken", ""))
			config.set_value("player", "token", device_token)
			config.save("user://table21.cfg")
			if OS.has_feature("web"):
				JavaScriptBridge.eval("localStorage.setItem('bj_device_token', %s);localStorage.setItem('bj_pseudo', %s);" % [JSON.stringify(device_token), JSON.stringify(pseudo)])
			player = payload.get("player", {})
			identified = true
			connection_changed.emit(true)
			player_received.emit(player)
		"playerUpdate":
			player = payload.get("player", {})
			player_received.emit(player)
		"tableState":
			table = payload.get("table", {})
			table_received.emit(table)
		"dealAnimation": card_dealt.emit(payload)
		"roundResult": round_result.emit(payload.get("results", []))
		"error": error_received.emit(str(payload.get("message", "Action refusée")))

func send_event(event: String, payload: Dictionary) -> void:
	if peer.get_ready_state() == WebSocketPeer.STATE_OPEN:
		peer.send_text("42" + JSON.stringify([event, payload]))

func close() -> void:
	stopped = true
	peer.close()
