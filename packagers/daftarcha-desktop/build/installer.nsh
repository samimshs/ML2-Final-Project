!macro customInstall
  CreateDirectory "$SMPROGRAMS\Daftarcha"
  CreateShortcut "$SMPROGRAMS\Daftarcha\Uninstall Daftarcha.lnk" "$INSTDIR\Uninstall Daftarcha.exe"
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\Daftarcha\Uninstall Daftarcha.lnk"
  RMDir "$SMPROGRAMS\Daftarcha"
!macroend
