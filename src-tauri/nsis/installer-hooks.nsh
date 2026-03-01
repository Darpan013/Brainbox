; BrainBox NSIS Uninstall Hooks
; This script is executed by the NSIS uninstaller to remove the
; sandboxed models directory from AppData when the user uninstalls.
; The app data lives at: %LOCALAPPDATA%\com.brainbox.app

!macro customUnInstall
    ; Remove the entire app data folder (models + config)
    RMDir /r "$LOCALAPPDATA\com.brainbox.app"
    ; Also clean from APPDATA (roaming) in case anything landed there
    RMDir /r "$APPDATA\com.brainbox.app"
!macroend
