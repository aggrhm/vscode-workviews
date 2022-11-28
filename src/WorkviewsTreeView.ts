import * as vscode from 'vscode';

export interface Editor {
    uri: string;
    viewColumn?: vscode.ViewColumn;
    visible?: boolean;
}
export interface Document {
    uri: string;
    lastViewColumn?: vscode.ViewColumn;
}
export class Workview {
    id: string;
    name: string;
    editors: Editor[];
    pinnedDocuments: Document[];
    
    static newID() : string {
        return `${Date.now()}`;
    }
    static editorToDocument(e: Editor) : Document {
        return {
            uri: e.uri,
            lastViewColumn: e.viewColumn
        };
    }
    static getURIBasename(uri: string) : string {
        let path = vscode.Uri.parse(uri).path;
        let basename = path.split("/").pop()!;
        return basename;
    }
    constructor(id: string, name: string, editors: Editor[], pinnedDocuments: Document[]) {
        this.id = id;
        this.name = name;
        this.editors = editors || [];
        this.pinnedDocuments = pinnedDocuments || [];
    }

    get editorDocuments() : Document[] {
        return this.editors.map((e)=>{
            return Workview.editorToDocument(e);
        });
    }

    setVisibleEditors(editors: vscode.TextEditor[]) {
        let eh : Record<string, Editor> = {};
        // index existing editors and set to not visible
        this.editors.forEach( (e)=> {
            e.visible = false;
            eh[e.uri] = e;
        });
        // add new editors
        editors.forEach ((e)=>{
            let uri = e.document.uri.toString();
            eh[uri] = {
                uri: uri,
                viewColumn: e.viewColumn || 1,
                visible: true
            };
        });
        // store new editors
        this.editors = Object.keys(eh).map( (k)=> {
            return eh[k];
        });
        console.debug("Updating editors to " + JSON.stringify(this.editors));
    }

    setEditorsFromWindow() {
        console.debug("Writing editors from vscode window.");
        this.editors = [];
        const groups = vscode.window.tabGroups.all;
        for (const group of groups) {
            for (const tab of group.tabs) {
                if (tab.input instanceof vscode.TabInputText) {
                    this.editors.push({
                        uri: tab.input.uri.toString(),
                        viewColumn: group.viewColumn || 1,
                        visible: tab.isActive
                    });
                }
            }
        }
    }

    findEditor(uri: string) : Editor {
        return this.editors.filter((e)=> {return e.uri == uri;})[0];
    }

    findPinnedDocument(uri: string) : Editor {
        return this.pinnedDocuments.filter((d)=> {return d.uri == uri;})[0];
    }

    removeEditor(uri: string) : boolean {
        let len = this.editors.length;
        this.editors = this.editors.filter( (e) => {return e.uri != uri;});
        //console.log("Editors is now: " + JSON.stringify(this.editors));
        return this.editors.length != len;
    }

    pinDocument(doc: Document) : boolean {
        if (this.findPinnedDocument(doc.uri)) { return false };
        this.pinnedDocuments.push(doc);
        return true;
    }

    unpinDocument(doc: Document) : boolean {
        if (!this.findPinnedDocument(doc.uri)) { return false };
        this.pinnedDocuments = this.pinnedDocuments.filter((d)=> {return d.uri != doc.uri;});
        return true;
    }
}
export enum TreeItemType {
    WORKVIEW = 'workview', DOCUMENT = 'document', SECTION_RELEVANT = 'section_relevant', SECTION_WORKVIEWS = 'section_workviews'
}
export class TreeItem {
    public type: TreeItemType;
    public title: string;
    public data: any;
    public pinned: boolean;
    
    constructor(type: TreeItemType, title: string, data: any) {
        this.type = type;
        this.title = title;
        this.data = data;
        this.pinned = false;
    }
}

export class WorkviewsTreeView implements vscode.TreeDataProvider<TreeItem> {
    workviews: Workview[];
    activeWorkviewID?: string;
    lastSavedAt: Date;

    constructor() {
        this.workviews = [];
        // load from workspace
        console.debug("Loading workviews state from settings");
        const base64 = vscode.workspace.getConfiguration().get('workviews.state', '');
        const decoded = Buffer.from(base64, 'base64').toString('ascii');
        try {
            const data = JSON.parse(decoded);
            this.workviews = data.workviews.map( (s : any) => {
                return new Workview(s.id, s.name, s.editors || [], s.pinnedDocuments || []);
            });
            if (data.activeWorkviewID && vscode.workspace.getConfiguration().get('workviews.rememberActiveWorkview', false)) {
                this.activeWorkviewID = data.activeWorkviewID;
            }
            console.debug("Settings successfully loaded.");
        } catch (ex:any) {
            console.debug(`Settings were not successfully decoded (${ex.message}).`);
        }
        this.lastSavedAt = new Date();
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
            if (element.pinned == true) { ret.contextValue = "document_pinned"; }
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
                // set hash
                let mh : Record<string, TreeItem> = {};
                // list documents
                workview.editors.forEach( (e)=> {
                    let d = Workview.editorToDocument(e);
                    let ti = new TreeItem(TreeItemType.DOCUMENT, Workview.getURIBasename(d.uri), d);
                    mh[d.uri] = ti;
                });
                workview.pinnedDocuments.forEach( (d)=> {
                    let ti = new TreeItem(TreeItemType.DOCUMENT, Workview.getURIBasename(d.uri), d);
                    ti.pinned = true;
                    mh[d.uri] = ti;
                });
                let items = Object.values(mh);
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

        // restore only pinned and visible documents
        if (vscode.workspace.getConfiguration().get("workviews.restorePinnedOnly", false)) {
            workview.editors = workview.editors.filter((e)=>{
                return e.visible == true || workview.findPinnedDocument(e.uri) != undefined;
            });
        }

        // sort editor views
        let sorted_editors = workview.editors.sort( (e1, e2)=> {
            let v1 = (e1.viewColumn || 1) * 10 + (e1.visible ? 1 : 0);
            let v2 = (e2.viewColumn || 1) * 10 + (e2.visible ? 1 : 0);
            return v1 - v2;
        });

        // open editor views
        for (let editor of sorted_editors) {
            this.openEditor(editor);
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

    async forActiveWorkview(fn: (workview: Workview)=>boolean, forceSave: boolean = false) {
        let view = this.activeWorkview();
        if (!view) return;
        let changed = fn(view);
        if (changed || forceSave) {
            await this.notifyChanged(forceSave);
        }
    }

    async handleVisibleTextEditorsChanged(editors: readonly vscode.TextEditor[]) {
		console.debug("Visible editors updated.");
        let view = this.activeWorkview();
        if (!view) return;
        view.setEditorsFromWindow();
        await this.notifyChanged();
    }

    async openDocument(document: Document) {
        let doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(document.uri));
        await vscode.window.showTextDocument(doc, {viewColumn: document.lastViewColumn, preview: false});
    }
    async openEditor(editor: Editor) {
        let doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(editor.uri));
        await vscode.window.showTextDocument(doc, {viewColumn: editor.viewColumn, preview: false});
    }

    async clearEditors() {
        // save existing editors
        //let editors = vscode.window.visibleTextEditors;
        //let documents = vscode.workspace.textDocuments;
        //console.debug("Found " + editors.length + " editors");
        let workview = this.activeWorkview();
        if (workview) {
            workview.setEditorsFromWindow();
        }
        this.activeWorkviewID = undefined;
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
        this.lastSavedAt = new Date();
        return true;
    }

    async notifyChanged(forceSave: boolean = false) {
        console.debug("Saving if stale.");
        let now = new Date();
        if (forceSave || ((now.getTime() - this.lastSavedAt.getTime()) / 1000 > 120)) {
            await this.save();
        } else {
            this._onDidChangeTreeData.fire();
            return true;
        }
    }
}

