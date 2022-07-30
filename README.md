# Workviews

[![Donate Ko-Fi](https://img.shields.io/badge/donate-ko--fi-29abe0.svg?style=for-the-badge&logo=ko-fi)](https://ko-fi.com/agquick)

This extension allows you to quickly switch between sets of files (i.e. "workviews") within a VS Code window. 

Your active workview is automatically saved each time it is switched. The extension shows up in the "Explorer" tab and can be rearranged.

![Extension Preview](images/preview.png)

## Features

* Easily create a workview by clicking the "+" at the top right of the extension
* Autosaves current workview when a new workview is selected
* Keeps track of files relevant to a workview when they are opened and closed (also manually removable)
* Attempts to restore the tabs in the same grid position
* Ability to pin documents to keep them in the workview document list

## Extension Settings

This extension contributes the following settings:

* `workviews.state`: (readonly) The internal state of the extension, allowing workviews to be persisted
* `workviews.rememberActiveWorkview`: (boolean) Keep track of active workview in saved state
* `workviews.restorePinnedOnly`: (boolean) Restore only the pinned and last viewed documents, rather than all documents opened

## Known Issues

* VS Code does not provide ability to directly access open editors at this time ([vscode #15178](https://github.com/Microsoft/vscode/issues/15178))

## Release Notes

For local deployment:

```
# add CHANGELOG entry 
# update package.json version

$ vsce package
$ code --install-extension workviews-1.1.x.vsix

# or

$ vsce publish [major|minor|patch]
```