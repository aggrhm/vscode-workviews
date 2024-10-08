// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { WorkviewsTreeView, Workview, TreeItem } from './WorkviewsTreeView';

let workviewsView = new WorkviewsTreeView();

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "workviews" is now active!');

	if (!workviewsView.extensionContext) {
		workviewsView.loadForContext(context);
	}
	vscode.window.registerTreeDataProvider('workviews', workviewsView);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('workviews.startNewWorkview', async () => {
		// Display a message box to the user
		// vscode.window.showInformationMessage('Hello from Workviews!');
		let name = await vscode.window.showInputBox({
			placeHolder: "Enter name for this workview"
		})
		if (name === undefined) { return false; }
		name = name.trim();
		workviewsView.startNewWorkview(name);
		return true;
	});
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('workviews.restoreWorkview', async (item: TreeItem) => {
		workviewsView.restoreWorkview(item.data);
	})
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('workviews.deleteWorkview', async (item: TreeItem) => {
		workviewsView.deleteWorkview(item.data);
	})
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('workviews.renameWorkview', async (item: TreeItem) => {
		let name = await vscode.window.showInputBox({
			placeHolder: "Enter new name for this workview"
		})
		if (name === undefined) { return false; }
		name = name.trim();
		workviewsView.renameWorkview(item.data, name);
	})
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('workviews.openDocument', async (item: TreeItem) => {
		workviewsView.openDocument(item.data);
	})
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('workviews.removeWorkviewDocument', async (item: TreeItem) => {
		workviewsView.forActiveWorkview((workview)=>{
			return workview.removeEditor(item.data.uri);
		}, true);
	});
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('workviews.pinWorkviewDocument', async (item: TreeItem) => {
		workviewsView.forActiveWorkview((workview)=>{
			return workview.pinDocument(item.data);
		}, true);
	});
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('workviews.unpinWorkviewDocument', async (item: TreeItem) => {
		workviewsView.forActiveWorkview((workview)=>{
			return workview.unpinDocument(item.data);
		}, true);
	});
	context.subscriptions.push(disposable);

	// window events
	disposable = vscode.window.tabGroups.onDidChangeTabs( (ev)=> {
		workviewsView.handleWindowTabChanged(ev);
	});
	context.subscriptions.push(disposable);
	disposable = vscode.window.onDidChangeVisibleTextEditors( (editors)=>{
		//workviewsView.handleVisibleTextEditorsChanged(editors);
	});
	context.subscriptions.push(disposable);
	disposable = vscode.workspace.onDidCloseTextDocument( (doc)=>{
		console.debug("Closing document " + doc.uri.toString());
		//console.debug("Closing document " + doc.fileName);
		//workviewsView.handleTextDocumentClosed(doc);
	});
	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
	console.debug("Saving workviews state before closing.");
	return workviewsView.save();
}
