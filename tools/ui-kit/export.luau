-- export.luau: read-only export of Woven's authored ScreenGuis to JSON for the HTML UI kit (tools/ui-kit).
-- Run through the roblox-studio MCP execute_luau with datamodel_type "Edit". It changes nothing in the place.
-- Set ONLY to one ScreenGui name ("StarterGui/MainHUD" style key) to export a single gui; nil lists the keys.
-- MODE: "list" returns the gui keys, "gui" exports ONLY, "meta" returns place info and code-token module sources,
-- "sizes" returns native pixel sizes for IDS (EditableImage; read-only, nothing is parented),
-- "runtime" returns the client scripts that name each runtime-built gui in NAMES.
local MODE = "list"
local ONLY = nil
local IDS = {}
local NAMES = {}

local HttpService = game:GetService("HttpService")

local ROOTS = {}
for _, g in ipairs(game:GetService("StarterGui"):GetChildren()) do
	if g:IsA("ScreenGui") then table.insert(ROOTS, { key = "StarterGui/" .. g.Name, gui = g, source = "StarterGui" }) end
end
for _, n in ipairs({ "PlayHUD", "SaveSlotHUD" }) do
	local g = game:GetService("ReplicatedFirst"):FindFirstChild(n)
	if g then table.insert(ROOTS, { key = "ReplicatedFirst/" .. n, gui = g, source = "ReplicatedFirst" }) end
end

local function get(inst, prop)
	local ok, v = pcall(function() return inst[prop] end)
	if ok then return v end
	return nil
end

local function hex(c)
	return string.format("#%02x%02x%02x", math.round(c.R * 255), math.round(c.G * 255), math.round(c.B * 255))
end

local function enc(v)
	local t = typeof(v)
	if t == "Color3" then return hex(v)
	elseif t == "UDim2" then return { v.X.Scale, v.X.Offset, v.Y.Scale, v.Y.Offset }
	elseif t == "UDim" then return { v.Scale, v.Offset }
	elseif t == "Vector2" then return { v.X, v.Y }
	elseif t == "Rect" then return { v.Min.X, v.Min.Y, v.Max.X, v.Max.Y }
	elseif t == "EnumItem" then return v.Name
	elseif t == "Font" then return { family = v.Family, weight = v.Weight.Name, style = v.Style.Name, bold = v.Bold }
	elseif t == "ColorSequence" then
		local k = {}
		for _, p in ipairs(v.Keypoints) do table.insert(k, { p.Time, hex(p.Value) }) end
		return k
	elseif t == "NumberSequence" then
		local k = {}
		for _, p in ipairs(v.Keypoints) do table.insert(k, { p.Time, p.Value, p.Envelope }) end
		return k
	elseif t == "Content" then
		return get(v, "Uri") or ""
	elseif t == "number" or t == "string" or t == "boolean" then return v
	end
	return nil
end

local function props(inst, list)
	local o = {}
	for _, p in ipairs(list) do
		local v = get(inst, p)
		if v ~= nil then o[p] = enc(v) end
	end
	return o
end

local GUI = { "Visible", "Size", "Position", "AnchorPoint", "Rotation", "ZIndex", "LayoutOrder", "ClipsDescendants",
	"BackgroundColor3", "BackgroundTransparency", "BorderSizePixel", "BorderColor3", "BorderMode", "AutomaticSize",
	"SizeConstraint", "Active", "Interactable" }
local TEXT = { "Text", "FontFace", "TextSize", "TextScaled", "TextColor3", "TextTransparency", "TextStrokeColor3",
	"TextStrokeTransparency", "TextXAlignment", "TextYAlignment", "TextWrapped", "RichText", "LineHeight",
	"PlaceholderText", "PlaceholderColor3" }
local IMAGE = { "Image", "ImageColor3", "ImageTransparency", "ScaleType", "SliceCenter", "SliceScale", "TileSize",
	"ImageRectOffset", "ImageRectSize", "ResampleMode" }
local SCROLL = { "CanvasSize", "CanvasPosition", "ScrollingDirection", "ScrollBarThickness", "ScrollBarImageColor3",
	"ScrollBarImageTransparency", "AutomaticCanvasSize" }
local MOD = {
	UICorner = { "CornerRadius" },
	UIStroke = { "Color", "Thickness", "Transparency", "ApplyStrokeMode", "LineJoinMode", "Enabled" },
	UIGradient = { "Color", "Transparency", "Rotation", "Offset", "Enabled" },
	UIPadding = { "PaddingTop", "PaddingBottom", "PaddingLeft", "PaddingRight" },
	UIListLayout = { "FillDirection", "Padding", "HorizontalAlignment", "VerticalAlignment", "SortOrder", "Wraps",
		"HorizontalFlex", "VerticalFlex", "ItemLineAlignment" },
	UIGridLayout = { "CellSize", "CellPadding", "FillDirection", "FillDirectionMaxCells", "StartCorner", "SortOrder",
		"HorizontalAlignment", "VerticalAlignment" },
	UIAspectRatioConstraint = { "AspectRatio", "AspectType", "DominantAxis" },
	UISizeConstraint = { "MinSize", "MaxSize" },
	UITextSizeConstraint = { "MinTextSize", "MaxTextSize" },
	UIScale = { "Scale" },
	UIFlexItem = { "FlexMode", "GrowRatio", "ShrinkRatio", "ItemLineAlignment" },
	UIPageLayout = { "FillDirection", "Padding", "SortOrder", "Circular" },
	UITableLayout = { "FillDirection", "Padding", "SortOrder" },
}

local function node(inst)
	local n = { name = inst.Name, class = inst.ClassName }
	if inst:IsA("GuiObject") then
		n.props = props(inst, GUI)
		if inst:IsA("TextLabel") or inst:IsA("TextButton") or inst:IsA("TextBox") then
			for k, v in pairs(props(inst, TEXT)) do n.props[k] = v end
		end
		if inst:IsA("ImageLabel") or inst:IsA("ImageButton") then
			for k, v in pairs(props(inst, IMAGE)) do n.props[k] = v end
		end
		if inst:IsA("ScrollingFrame") then
			for k, v in pairs(props(inst, SCROLL)) do n.props[k] = v end
		end
		if inst:IsA("CanvasGroup") then
			for k, v in pairs(props(inst, { "GroupTransparency", "GroupColor3" })) do n.props[k] = v end
		end
	elseif inst:IsA("StyleLink") then
		local sheet = get(inst, "StyleSheet")
		n.props = { StyleSheet = sheet and sheet:GetFullName() or nil }
	elseif MOD[inst.ClassName] then
		n.props = props(inst, MOD[inst.ClassName])
	elseif inst:IsA("LuaSourceContainer") then
		n.props = { Enabled = get(inst, "Enabled") }
		return n -- no source: scripts are listed, not exported
	elseif inst:IsA("ValueBase") then
		local v = get(inst, "Value")
		n.props = { Value = enc(v) }
	end
	local kids = {}
	for _, c in ipairs(inst:GetChildren()) do table.insert(kids, node(c)) end
	if #kids > 0 then n.children = kids end
	return n
end

if MODE == "list" then
	local keys = {}
	for _, r in ipairs(ROOTS) do table.insert(keys, r.key) end
	return HttpService:JSONEncode(keys)
elseif MODE == "meta" then
	local S = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
	local mods = {}
	for _, name in ipairs({ "ButtonTemplateView", "TopButtonTheme" }) do
		local m = S:FindFirstChild(name)
		if m then mods[name] = { path = m:GetFullName(), source = m.Source } end
	end
	return HttpService:JSONEncode({
		placeId = game.PlaceId, gameId = game.GameId, placeName = game.Name, placeVersion = game.PlaceVersion,
		exportedAt = DateTime.now():ToIsoDate(), roots = #ROOTS, codeModules = mods,
	})
elseif MODE == "sizes" then
	local AssetService = game:GetService("AssetService")
	local out = {}
	for _, id in ipairs(IDS) do
		local ok, img = pcall(function()
			return AssetService:CreateEditableImageAsync(Content.fromUri("rbxassetid://" .. id))
		end)
		if ok and img then
			out[id] = { img.Size.X, img.Size.Y }
			img:Destroy()
		else
			out[id] = { error = tostring(img) }
		end
	end
	return HttpService:JSONEncode(out)
elseif MODE == "runtime" then
	-- Finds which client scripts mention each runtime-built gui name as a string literal ("Name").
	local scripts = {}
	for _, svc in ipairs({ "StarterPlayer", "ReplicatedFirst", "ReplicatedStorage", "StarterGui" }) do
		for _, d in ipairs(game:GetService(svc):GetDescendants()) do
			if d:IsA("LuaSourceContainer") then table.insert(scripts, d) end
		end
	end
	local out = {}
	for _, name in ipairs(NAMES) do
		local pat = '"' .. name:gsub("%*", "%%w*") .. '"'
		local hits = {}
		for _, s in ipairs(scripts) do
			local ok, src = pcall(function() return s.Source end)
			if ok and src then
				local line = 0
				for l in (src .. "\n"):gmatch("([^\n]*)\n") do
					line += 1
					if l:find(pat) and (l:find("Name") or l:find("ScreenGui")) then
						table.insert(hits, { path = s:GetFullName(), line = line, enabled = get(s, "Enabled") })
						break
					end
				end
			end
			if #hits >= 4 then break end
		end
		out[name] = hits
	end
	return HttpService:JSONEncode(out)
end

for _, r in ipairs(ROOTS) do
	if r.key == ONLY then
		local g = r.gui
		local n = node(g)
		n.key = r.key
		n.source = r.source
		n.path = g:GetFullName()
		n.props = props(g, { "Enabled", "DisplayOrder", "IgnoreGuiInset", "ResetOnSpawn", "ScreenInsets",
			"ZIndexBehavior", "SafeAreaCompatibility", "ClipToDeviceSafeArea" })
		return HttpService:JSONEncode(n)
	end
end
error("ScreenGui not found: " .. tostring(ONLY))
