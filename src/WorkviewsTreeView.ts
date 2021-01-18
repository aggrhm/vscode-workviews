import * as vscode from 'vscode';

export interface Editor {
    uri: string;
    viewColumn?: vscode.ViewColumn;
}
export interface Document {
    uri: string;
    lastViewColumn?: vscode.ViewColumn;
}
export class Workview {
    id: string;
    name: string;
    editors: Editor[];
    documents: Document[];
    
    static newID() : string {
        return `${Date.now()}`;
    }
    constructor(id: string, name: string, editors: Editor[], documents: Document[]) {
        this.id = id;
        this.name = name;
        this.editors = editors || [];
        this.documents = documents || [];
    }

    setEditors(editors: vscode.TextEditor[]) {
        this.editors = editors.map( (e)=> {
            return {
                uri: e.document.uri.toString(),
                viewColumn: e.viewColumn || 1
            };
        }).sort( (e1, e2) => {
            return e1.viewColumn - e2.viewColumn;
        });
        let doch : Record<string,Document> = {};
        this.documents.forEach( (d)=> {
            doch[d.uri] = d;
        })
        editors.forEach( (e) => {
            let suri = e.document.uri.toString();
            doch[suri] = {
                uri: suri,
                lastViewColumn: e.viewColumn
            };
        });
        this.documents = Object.keys(doch).map( (key) => {
            let d = doch[key];
            return d;
        });
    }
}
export enum TreeItemType {
    WORKVIEW = 'workview', DOCUMENT = 'document', SECTION_RELEVANT = 'section_relevant', SECTION_WORKVIEWS = 'section_workviews'
}
export class TreeItem {
    public type: TreeItemType;
    public title: string;
    public data: any;
    
    constructor(type: TreeItemType, title: string, data: any) {
        this.type = type;
        this.title = title;
        this.data = data;
    }
}

export class WorkviewsTreeView implements vscode.TreeDataProvider<TreeItem> {
    workviews: Workview[];
    activeWorkviewID?: string;

    constructor() {
        this.workviews = [];
        // load from workspace
        const base64 = vscode.workspace.getConfiguration().get('workviews.state', '');
        const decoded = Buffer.from(base64, 'base64').toString('ascii');
        try {
            const data = JSON.parse(decoded);
            this.workviews = data.workviews.map( (s : any) => {
                return new Workview(s.id, s.name, s.editors || [], s.documents || []);
            });
            this.activeWorkviewID = data.activeWorkviewID;
        } catch {
            console.debug("Settings were not successfully decoded.");
        }
    }

    private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    getTreeItem(element: TreeItem): vscode.TreeItem {
        const ret = new vscode.TreeItem(element.title, vscode.TreeItemCollapsibleState.None);
        ret.contextValue = element.type;
        if (element.type == TreeItemType.WORKVIEW) {
            if (element.data.id == this.activeWorkviewID) {
                ret.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                /*
                ret.label = {
                    highlights: [[0, (element.title.length-1)]],
                    label: element.title
                }
                */
            }
            ret.iconPath = new vscode.ThemeIcon("book");
            ret.command = {
                command: 'workviews.restoreWorkview',
                title: 'Restore workview',
                arguments: [element]
            }
        } else if (element.type == TreeItemType.SECTION_RELEVANT || element.type == TreeItemType.SECTION_WORKVIEWS) {
            ret.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        } else if (element.type == TreeItemType.DOCUMENT) {
            ret.collapsibleState = vscode.TreeItemCollapsibleState.None;
            ret.resourceUri = vscode.Uri.parse((element.data as Document).uri);
            //ret.iconPath = new vscode.ThemeIcon("selection");
            ret.command = {
                command: 'workviews.openDocument',
                title: 'Open Document',
                arguments: [element]
            }
        }
        return ret;
    }

    getChildren(element?: TreeItem): vscode.ProviderResult<TreeItem[]> {
        if (element === undefined) {
            // list items
            let items: TreeItem[] = [];
            this.workviews.forEach( (workview)=> {
                items.push(new TreeItem(TreeItemType.WORKVIEW, workview.name, workview));
            });
            items.sort( (s1, s2) => {
                return s1.title.localeCompare(s2.title);
            });
            return Promise.resolve(items);
        } else if (element.type == TreeItemType.WORKVIEW) {
            let workview = this.activeWorkview();
            if (workview && workview == element.data) {
                // list documents
                let items = workview.documents.map( (d)=> {
                    let path = vscode.Uri.parse(d.uri).path;
                    let basename = path.split("/").pop()!;
                    return new TreeItem(TreeItemType.DOCUMENT, basename, d)
                });
                items.sort( (s1, s2) => {
                    return s1.title.localeCompare(s2.title);
                });
                return Promise.resolve(items);
            } else {
                return Promise.resolve([]);
            }
        } else {
            return Promise.resolve([]);
        }
    }

    activeWorkview() : Workview | null {
        if (!this.activeWorkviewID) { return null; }
        let workview = this.workviews.filter( (w) => {return w.id == this.activeWorkviewID} )[0];
        return workview;
    }

    async startNewWorkview(name: string) {
        console.log("Starting new workview.");
        // clear active workview
        await this.clearEditors();

        // create new workview
        let workview = new Workview(Workview.newID(), name, [], []);
        this.workviews.push(workview);
        this.activeWorkviewID = workview.id;

        // save state
        await this.save();
    }

    async restoreWorkview(workview: Workview) {
        console.log("Restoring workview");

        // clear active workview
        await this.clearEditors();

        // load editor views
        for (let editor of workview.editors) {
            let doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(editor.uri));
            await vscode.window.showTextDocument(doc, {viewColumn: editor.viewColumn, preview: false});
        }

        // set as active workview
        this.activeWorkviewID = workview.id;

        // save
        await this.save();
    }

    async renameWorkview(workview: Workview, newName: string) {
        console.debug("Renaming workview " + workview.id);
        workview.name = newName;
        await this.save();
    }

    async deleteWorkview(workview: Workview) {
        console.debug("Deleting workview " + JSON.stringify(workview));
        this.workviews = this.workviews.filter( (w)=> { return w.id != workview.id; });
        if (this.activeWorkviewID == workview.id) { this.activeWorkviewID = undefined; }

        await this.save();
    }

    async openDocument(document: Document) {
        let doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(document.uri));
        await vscode.window.showTextDocument(doc, {viewColumn: document.lastViewColumn, preview: false});
    }

    async removeRelevantDocument(document: Document) {
        let workview = this.activeWorkview();
        if (!workview) return;
        workview.documents = workview.documents.filter( (d) => {return d.uri != document.uri;});
        await this.save();
    }

    async clearEditors() {
        // save existing editors
        let editors = vscode.window.visibleTextEditors;
        //let documents = vscode.workspace.textDocuments;
        console.debug("Found " + editors.length + " editors");
        let workview = this.activeWorkview();
        if (workview) {
            workview.setEditors(editors);
        }
        return vscode.commands.executeCommand('workbench.action.closeAllGroups');
    }

    async save() {
        console.log("Saving state.");
        const json = JSON.stringify({workviews: this.workviews, activeWorkviewID: this.activeWorkviewID});
        console.debug("Saving " + json);
        const data = Buffer.from(json).toString("base64");
        await vscode.workspace.getConfiguration().update("workviews.state", data, false);
        this._onDidChangeTreeData.fire();
        console.debug("Saved.");
        return true;
    }
}

