param(
  [string]$ApiBase = "http://127.0.0.1:8000",
  [string]$UiBase = "http://127.0.0.1:5173"
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

function Invoke-LifeOSQuickCapture {
  $form = New-Object System.Windows.Forms.Form
  $form.Text = "LifeOS Quick Capture"
  $form.Width = 520
  $form.Height = 260
  $form.StartPosition = "CenterScreen"

  $text = New-Object System.Windows.Forms.TextBox
  $text.Multiline = $true
  $text.Width = 470
  $text.Height = 140
  $text.Left = 16
  $text.Top = 16
  $text.ScrollBars = "Vertical"

  $button = New-Object System.Windows.Forms.Button
  $button.Text = "Capture"
  $button.Width = 100
  $button.Height = 32
  $button.Left = 386
  $button.Top = 170

  $button.Add_Click({
    if ($text.Text.Trim().Length -eq 0) { return }
    $body = @{ raw_text = $text.Text; privacy_level = "private_user" } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "$ApiBase/api/v1/agent/windows/quick-capture" -ContentType "application/json" -Body $body | Out-Null
    $form.Close()
  })

  $form.Controls.Add($text)
  $form.Controls.Add($button)
  $form.ShowDialog() | Out-Null
}

$icon = [System.Drawing.SystemIcons]::Application
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Text = "LifeOS"
$tray.Icon = $icon
$tray.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip

$open = $menu.Items.Add("Open LifeOS")
$open.Add_Click({ Start-Process $UiBase })

$capture = $menu.Items.Add("Quick Capture")
$capture.Add_Click({ Invoke-LifeOSQuickCapture })

$review = $menu.Items.Add("Review Mode")
$review.Add_Click({
  Invoke-RestMethod -Method Post -Uri "$ApiBase/api/v1/focus-state" -ContentType "application/json" -Body (@{ state = "review" } | ConvertTo-Json) | Out-Null
  Start-Process $UiBase
})

$focus = $menu.Items.Add("Focus Mode")
$focus.Add_Click({
  Invoke-RestMethod -Method Post -Uri "$ApiBase/api/v1/focus-state" -ContentType "application/json" -Body (@{ state = "focus" } | ConvertTo-Json) | Out-Null
})

$menu.Items.Add("-") | Out-Null

$exit = $menu.Items.Add("Exit Agent")
$exit.Add_Click({
  $tray.Visible = $false
  [System.Windows.Forms.Application]::Exit()
})

$tray.ContextMenuStrip = $menu
$tray.Add_DoubleClick({ Start-Process $UiBase })

[System.Windows.Forms.Application]::Run()
