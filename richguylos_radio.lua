-- RichGuyLos Radio — private phone-controlled in-game audio for each driver.
-- Every CSP client creates its own MediaPlayer. Nothing changes a global server station.

local QR_IMAGE_URL = 'https://richbreadyy.github.io/richguylos-radio/rgl-install-qr.png'
local SYNC_URL = 'wss://richguylos-radio-sync.richguylos-radio-sync.workers.dev'
local PLAYER_URL = 'https://richbreadyy.github.io/richguylos-radio/youtube-player.html'
local saved = ac.storage({ pairingCode = '' })
local pairingCode = saved.pairingCode
local socket = nil
local status = 'ENTER YOUR PHONE CODE'
local phoneOnline = false
local stateTimer = 0
local mediaPlayer = ui.MediaPlayer():setAutoPlay(false):setVolume(0.8)
local track = { loaded = false, playing = false, title = 'No private song selected', artist = 'RichGuyLos Radio', index = 0, queueLength = 0, source = 'phone-file', position = 0, duration = 0, volume = 0.8 }
local youtubeBrowser = nil
local browserAvailable, WebBrowser = pcall(require, 'shared/web/browser')

local colors = {
  background = rgbm(0.025, 0.071, 0.15, 0.97), border = rgbm(0.24, 0.49, 1, 0.7),
  blue = rgbm(0.24, 0.49, 1, 1), orange = rgbm(1, 0.42, 0.09, 1),
  green = rgbm(0.15, 0.87, 0.54, 1), white = rgbm(0.97, 0.97, 0.95, 1), muted = rgbm(0.63, 0.68, 0.79, 1)
}

local function normalizedCode()
  return pairingCode:gsub('[^%w]', ''):upper()
end

local function sendPhoneCommand(action)
  if socket ~= nil and phoneOnline then socket({ type = 'phone-command', action = action }) end
end

local function isPlaying()
  return track.source == 'youtube' and track.playing or (track.loaded and mediaPlayer:playing())
end

local function currentPosition()
  return track.source == 'youtube' and track.position or (track.loaded and mediaPlayer:currentTime() or 0)
end

local function currentDuration()
  return track.source == 'youtube' and track.duration or (track.loaded and mediaPlayer:duration() or 0)
end

local function currentVolume()
  return track.source == 'youtube' and track.volume or mediaPlayer:volume()
end

local function sendState()
  if socket == nil then return end
  socket({
    type = 'state', loaded = track.loaded, playing = isPlaying(),
    title = track.title, artist = track.artist, position = currentPosition(),
    duration = currentDuration(), volume = currentVolume(),
    trackIndex = track.index, queueLength = track.queueLength, canSkip = track.queueLength > 1, source = track.source
  })
end

local function applyCommand(message)
  if not track.loaded then return end
  if track.source == 'youtube' and youtubeBrowser ~= nil then
    local value = tonumber(message.value)
    youtubeBrowser:sendAsync('rgl-command', { action = message.action, value = value })
    if message.action == 'play' then track.playing = true end
    if message.action == 'pause' then track.playing = false end
    if message.action == 'seek' then track.position = math.max(0, value or 0) end
    if message.action == 'volume' then track.volume = math.clamp(value or 0.8, 0, 1) end
  else
    if message.action == 'play' then mediaPlayer:play() end
    if message.action == 'pause' then mediaPlayer:pause() end
    if message.action == 'seek' then mediaPlayer:setCurrentTime(math.max(0, tonumber(message.value) or 0)) end
    if message.action == 'volume' then mediaPlayer:setVolume(math.clamp(tonumber(message.value) or 0.8, 0, 1)) end
  end
  sendState()
end

local function loadTrack(message)
  if youtubeBrowser ~= nil then youtubeBrowser:sendAsync('rgl-command', { action = 'stop' }) end
  track.loaded = true
  track.source = 'phone-file'
  track.playing = message.autoplay ~= false
  track.title = tostring(message.title or 'Phone audio')
  track.artist = tostring(message.artist or 'Your phone')
  track.index = tonumber(message.trackIndex) or 0
  track.queueLength = tonumber(message.queueLength) or 1
  mediaPlayer:setSource(tostring(message.url)):setCurrentTime(0)
  if message.autoplay ~= false then
    setTimeout(function()
      mediaPlayer:play()
      sendState()
    end, 0.15)
  end
  status = 'PRIVATE AUDIO READY'
end

local function loadYouTube(message)
  if not browserAvailable then
    status = 'YOUTUBE NEEDS CSP WEB BROWSER SUPPORT'
    return
  end
  mediaPlayer:pause()
  if youtubeBrowser == nil then
    youtubeBrowser = WebBrowser({ size = vec2(640, 360), redirectAudio = true, dataKey = 'richguylos-radio-youtube' })
      :onLoadEnd(function(browser)
        setTimeout(function()
          browser:awake():mouseInput(vec2(0.5, 0.5), true)
          setTimeout(function() browser:mouseInput(vec2(0.5, 0.5), false) end, 0.08)
        end, 2.5)
      end)
      :onReceive('youtube-state', function(_, data)
        track.loaded = data.loaded ~= false
        track.playing = data.playing == true
        track.title = tostring(data.title or track.title)
        track.artist = tostring(data.artist or 'YouTube')
        track.position = tonumber(data.position) or track.position
        track.duration = tonumber(data.duration) or track.duration
        track.volume = math.clamp(tonumber(data.volume) or track.volume, 0, 1)
        sendState()
      end)
      :onReceive('youtube-error', function(_, data)
        status = 'YOUTUBE VIDEO CANNOT PLAY • CODE '..tostring(data.code or '?')
      end)
  end
  track.loaded = true
  track.playing = message.autoplay ~= false
  track.title = tostring(message.title or 'YouTube Music')
  track.artist = tostring(message.artist or 'YouTube')
  track.source = 'youtube'
  track.position = 0
  track.duration = 0
  track.queueLength = 1
  youtubeBrowser:navigate(PLAYER_URL..'?v='..tostring(message.videoId))
  status = 'YOUTUBE LOADING • PRIVATE TO YOU'
  sendState()
end

local function disconnect()
  if socket ~= nil then socket:close() end
  socket = nil
  phoneOnline = false
  status = 'PHONE DISCONNECTED • AUDIO STAYS LOCAL'
end

local function connect()
  disconnect()
  local code = normalizedCode()
  if #code < 6 or SYNC_URL:find('YOUR%-RICHGUYLOS') then
    status = SYNC_URL:find('YOUR%-RICHGUYLOS') and 'SYNC SERVICE NOT CONFIGURED' or 'CHECK PAIRING CODE'
    return
  end
  status = 'CONNECTING...'
  socket = web.socket(SYNC_URL..'/sync/'..code..'?role=game', function(message)
    if message.type == 'hello' then status = 'GAME PLAYER ONLINE' end
    if message.type == 'presence' then
      phoneOnline = message.phoneConnected == true
      status = phoneOnline and 'PHONE CONNECTED • PRIVATE TO YOU' or 'WAITING FOR YOUR PHONE'
      if phoneOnline then sendState() end
    end
    if message.type == 'load' then loadTrack(message) end
    if message.type == 'youtube-load' then loadYouTube(message) end
    if message.type == 'command' then applyCommand(message) end
  end, {
    encoding = 'json', reconnect = true,
    onError = function() status = 'RECONNECTING...' phoneOnline = false end,
    onClose = function() status = 'DISCONNECTED' phoneOnline = false end
  })
end

setTimeout(function()
  if #normalizedCode() >= 6 then connect() end
end, 0.8)

local function timeLabel(value)
  value = tonumber(value) or 0
  if value ~= value then value = 0 end
  value = math.max(0, math.floor(value))
  return string.format('%d:%02d', math.floor(value / 60), value % 60)
end

function script.update(dt)
  if youtubeBrowser ~= nil and track.source == 'youtube' then youtubeBrowser:awake() end
  stateTimer = stateTimer + dt
  if stateTimer > 0.75 then
    stateTimer = 0
    sendState()
  end
end

function script.drawUI()
  local viewport = ui.windowSize()
  local panelSize = vec2(610, 300)
  ui.setCursor(vec2(viewport.x - panelSize.x - 24, viewport.y - panelSize.y - 92))
  ui.pushStyleVar(ui.StyleVar.ChildRounding, 10)
  ui.pushStyleVar(ui.StyleVar.FrameRounding, 6)
  ui.pushStyleColor(ui.StyleColor.ChildBg, colors.background)
  ui.pushStyleColor(ui.StyleColor.Border, colors.border)
  ui.pushStyleColor(ui.StyleColor.Button, colors.blue)
  ui.pushStyleColor(ui.StyleColor.ButtonHovered, rgbm(0.34, 0.59, 1, 1))
  ui.pushStyleColor(ui.StyleColor.Text, colors.white)

  ui.childWindow('##richguylosPrivateRadio', panelSize, true, 0, function()
    ui.offsetCursorX(12)
    ui.offsetCursorY(9)
    ui.textColored('RICHGUYLOS RADIO', colors.blue)
    ui.sameLine(0, 8)
    ui.textColored(phoneOnline and '● PRIVATE PHONE LIVE' or '○ PHONE OFFLINE', phoneOnline and colors.green or colors.orange)
    ui.offsetCursorX(12)
    ui.textColored(status, colors.muted)
    ui.offsetCursorX(12)
    ui.pushItemWidth(188)
    local editedCode = ui.inputText('##rglPairCode', pairingCode)
    if editedCode ~= pairingCode then
      pairingCode = editedCode
      saved.pairingCode = editedCode
    end
    ui.popItemWidth()
    ui.sameLine(0, 8)
    if socket == nil then
      if ui.button('CONNECT', vec2(92, 28)) then connect() end
    else
      if ui.button('DISCONNECT', vec2(92, 28)) then disconnect() end
    end
    ui.sameLine(0, 10)
    ui.textColored('SCAN QR →', colors.orange)
    ui.offsetCursorX(12)
    ui.offsetCursorY(8)
    ui.textColored(track.title, colors.white)
    ui.offsetCursorX(12)
    ui.textColored(track.artist..'  •  '..timeLabel(currentPosition())..' / '..timeLabel(currentDuration()), colors.muted)
    ui.offsetCursorX(12)
    ui.offsetCursorY(8)
    if phoneOnline and track.queueLength > 1 then
      if ui.button('PREV', vec2(72, 38)) then sendPhoneCommand('previous') end
      ui.sameLine(0, 8)
    end
    if track.loaded then
      if ui.button(isPlaying() and 'PAUSE' or 'PLAY', vec2(112, 38)) then
        applyCommand({ action = isPlaying() and 'pause' or 'play' })
      end
    else
      ui.textColored('WAITING FOR PHONE SONG', colors.orange)
    end
    if phoneOnline and track.queueLength > 1 then
      ui.sameLine(0, 8)
      if ui.button('NEXT', vec2(72, 38)) then sendPhoneCommand('next') end
    end
    ui.sameLine(0, 10)
    ui.textColored(string.format('VOL %d', math.floor(currentVolume() * 100)), colors.muted)
    ui.offsetCursorX(12)
    local nextVolume, changed = ui.slider('##rglVolume', currentVolume(), 0, 1, '')
    if changed then
      applyCommand({ action = 'volume', value = nextVolume })
    end
    ui.offsetCursorX(12)
    ui.textColored('Only you hear this player. Other drivers keep their own music.', colors.muted)

    ui.drawRectFilled(vec2(432, 44), vec2(592, 204), rgbm.colors.white, 7)
    ui.drawImageRounded(QR_IMAGE_URL, vec2(438, 50), vec2(586, 198), 4)
    ui.setCursor(vec2(432, 214))
    ui.textColored('SCAN WITH YOUR PHONE', colors.white)
    ui.setCursor(vec2(432, 235))
    ui.textColored('DIRECT APP DOWNLOAD', colors.muted)
    ui.setCursor(vec2(432, 258))
    ui.textColored('ANDROID APK', colors.green)
  end)

  ui.popStyleColor(5)
  ui.popStyleVar(2)
end
