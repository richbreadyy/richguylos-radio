-- RichGuyLos Radio — original Assetto Corsa CSP online integration.
-- This script only displays a small invitation and opens the public radio site.

local RADIO_URL = 'https://richbreadyy.github.io/richguylos-radio/'
local visibleFor = 14
local dismissed = false

local colors = {
  background = rgbm(0.025, 0.071, 0.15, 0.96),
  border = rgbm(0.24, 0.49, 1, 0.7),
  blue = rgbm(0.24, 0.49, 1, 1),
  orange = rgbm(1, 0.42, 0.09, 1),
  white = rgbm(0.97, 0.97, 0.95, 1),
  muted = rgbm(0.63, 0.68, 0.79, 1)
}

function script.update(dt)
  if visibleFor > 0 then
    visibleFor = visibleFor - dt
  end
end

function script.drawUI()
  if dismissed or visibleFor <= 0 then return end

  local viewport = ui.windowSize()
  local panelSize = vec2(340, 118)
  ui.setCursor(vec2(viewport.x - panelSize.x - 24, viewport.y - panelSize.y - 92))

  ui.pushStyleVar(ui.StyleVar.ChildRounding, 10)
  ui.pushStyleVar(ui.StyleVar.FrameRounding, 6)
  ui.pushStyleColor(ui.StyleColor.ChildBg, colors.background)
  ui.pushStyleColor(ui.StyleColor.Border, colors.border)
  ui.pushStyleColor(ui.StyleColor.Button, colors.orange)
  ui.pushStyleColor(ui.StyleColor.ButtonHovered, rgbm(1, 0.5, 0.16, 1))
  ui.pushStyleColor(ui.StyleColor.Text, colors.white)

  ui.childWindow('##richguylosRadioInvite', panelSize, true, 0, function()
    ui.offsetCursorX(10)
    ui.offsetCursorY(8)
    ui.textColored('RICHGUYLOS RADIO', colors.blue)
    ui.sameLine(0, 8)
    ui.textColored('● LIVE', colors.orange)
    ui.offsetCursorX(10)
    ui.textColored('Every city has a sound.', colors.muted)
    ui.offsetCursorX(10)
    ui.offsetCursorY(7)

    if ui.button('OPEN RADIO', vec2(238, 34)) then
      os.openURL(RADIO_URL)
      dismissed = true
    end
    ui.sameLine(0, 8)
    if ui.button('LATER', vec2(62, 34)) then
      dismissed = true
    end
  end)

  ui.popStyleColor(5)
  ui.popStyleVar(2)
end
