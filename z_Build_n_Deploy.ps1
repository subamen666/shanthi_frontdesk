Set-Location $PSScriptRoot
npm install
npm run build
# Compress-Archive -Path ".\dist\*" -DestinationPath "uploadThis.zip"

# DEPLOYMENT TOKEN FOR SHANTHI
swa deploy ./dist --env production --deployment-token acc10164a283bf33011b44e1bdf974ed3fa594097641e9aa1d40c857b8e1eb4106-0e86bbf3-f5c3-4bf8-acd3-bdf1c0227c4000f06030964aec0f