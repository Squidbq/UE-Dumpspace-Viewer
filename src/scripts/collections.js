class CollectionManager {
    constructor(app) {
        this.app = app;
    }

    openOffsetsModal() {
        const modal = document.getElementById('offsetsCollectionModal');
        if (modal) {
            modal.style.display = 'flex';
            if (this.loadCollections) {
                this.loadCollections();
            }
        }
    }

    closeOffsetsModal() {
        const modal = document.getElementById('offsetsCollectionModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    showNewCollectionDialog() {
        const detected = this.extractGameInfoFromPath(this.app.selectedFolderPath);
        this.app.detectedGameInfo = detected;
        
        const dumpInfo = this.getDumpTimestamp();
        
        const gameNameInput = document.getElementById('newCollectionGameName');
        const gameVersionInput = document.getElementById('newCollectionGameVersion');
        const dumpDateInput = document.getElementById('newCollectionDumpDate');
        const nameInput = document.getElementById('newCollectionName');
        
        [gameNameInput, gameVersionInput, dumpDateInput, nameInput].forEach(input => {
            if (input) {
                input.disabled = false;
                input.readOnly = false;
                input.removeAttribute('readonly');
                input.removeAttribute('disabled');
                input.style.pointerEvents = 'auto';
                input.style.opacity = '1';
                input.onmousedown = null;
                input.onclick = null;
            }
        });
        
        if (gameNameInput) {
            gameNameInput.value = detected.gameName || '';
        }
        if (gameVersionInput) {
            gameVersionInput.value = detected.gameVersion || '';
        }
        if (dumpDateInput) {
            dumpDateInput.value = dumpInfo.date;
        }
        if (nameInput) {
            nameInput.value = '';
        }
        
        const dialog = document.getElementById('newCollectionDialog');
        if (dialog) {
            dialog.style.display = 'flex';
            dialog.style.pointerEvents = 'auto';
            dialog.style.zIndex = '10002';
            
            const overlay = dialog.querySelector('.new-collection-dialog-overlay');
            const content = dialog.querySelector('.new-collection-dialog-content');
            
            if (content) {
                content.style.pointerEvents = 'auto';
                content.style.zIndex = '10003';
                content.style.position = 'relative';
            }
            
            if (overlay) {
                overlay.style.pointerEvents = 'none';
            }
            
            const dialogClickHandler = (e) => {
                const clickedOnOverlay = overlay && (e.target === overlay || overlay.contains(e.target));
                const clickedOnDialog = e.target === dialog;
                const clickedOnContent = content && content.contains(e.target);
                
                if ((clickedOnOverlay || clickedOnDialog) && !clickedOnContent) {
                    this.closeNewCollectionDialog();
                }
            };
            const existingHandler = dialog._dialogClickHandler;
            if (existingHandler) {
                dialog.removeEventListener('click', existingHandler);
            }
            dialog.addEventListener('click', dialogClickHandler);
            dialog._dialogClickHandler = dialogClickHandler;
            
            if (content) {
                const contentClickHandler = (e) => {
                    e.stopPropagation();
                };
                const existingContentHandler = content._contentClickHandler;
                if (existingContentHandler) {
                    content.removeEventListener('click', existingContentHandler);
                }
                content.addEventListener('click', contentClickHandler);
                content._contentClickHandler = contentClickHandler;
            }
            
            const allInputs = content ? content.querySelectorAll('input, textarea') : [];
            allInputs.forEach(input => {
                input.style.pointerEvents = 'auto';
                input.style.position = 'relative';
                input.style.zIndex = '10004';
            });
            
            void dialog.offsetHeight;
            
            if (window.focus) {
                window.focus();
            }
            
            document.body.focus();
            
            const focusInput = () => {
                const nameInput = document.getElementById('newCollectionName');
                if (nameInput) {
                    nameInput.disabled = false;
                    nameInput.readOnly = false;
                    nameInput.removeAttribute('readonly');
                    nameInput.removeAttribute('disabled');
                    nameInput.style.pointerEvents = 'auto';
                    nameInput.style.opacity = '1';
                    nameInput.tabIndex = 0;
                    
                    try {
                        nameInput.focus({ preventScroll: true });
                        
                        if (document.activeElement !== nameInput) {
                            setTimeout(() => {
                                nameInput.focus({ preventScroll: true });
                                
                                if (document.activeElement !== nameInput) {
                                    const rect = nameInput.getBoundingClientRect();
                                    const clickEvent = new MouseEvent('click', {
                                        bubbles: true,
                                        cancelable: true,
                                        view: window,
                                        clientX: rect.left + rect.width / 2,
                                        clientY: rect.top + rect.height / 2,
                                        button: 0
                                    });
                                    nameInput.dispatchEvent(clickEvent);
                                    nameInput.focus({ preventScroll: true });
                                    
                                    if (document.activeElement !== nameInput) {
                                        nameInput.click();
                                        nameInput.focus({ preventScroll: true });
                                    }
                                }
                            }, 50);
                        } else {
                            setTimeout(() => {
                                nameInput.click();
                            }, 10);
                        }
                    } catch (e) {
                        console.warn('Could not focus name input:', e);
                    }
                }
            };
            
            requestAnimationFrame(() => {
                focusInput();
                requestAnimationFrame(() => {
                    setTimeout(() => focusInput(), 100);
                    setTimeout(() => focusInput(), 200);
                    setTimeout(() => focusInput(), 300);
                });
            });
        }
    }

    showConfirmDialog(title, message, onConfirm, onCancel = null) {
        const dialog = document.getElementById('confirmDialog');
        const titleEl = document.getElementById('confirmDialogTitle');
        const messageEl = document.getElementById('confirmDialogMessage');
        const confirmBtn = document.getElementById('confirmDialogConfirm');
        const cancelBtn = document.getElementById('confirmDialogCancel');
        const closeBtn = document.getElementById('confirmDialogClose');
        const overlay = dialog ? dialog.querySelector('.confirm-dialog-overlay') : null;
        
        if (!dialog || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
            return;
        }
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        
        dialog.style.display = 'flex';
        
        const oldConfirm = confirmBtn._confirmHandler;
        const oldCancel = cancelBtn._cancelHandler;
        const oldClose = closeBtn ? closeBtn._closeHandler : null;
        const oldOverlay = overlay ? overlay._overlayHandler : null;
        
        if (oldConfirm) confirmBtn.removeEventListener('click', oldConfirm);
        if (oldCancel) cancelBtn.removeEventListener('click', oldCancel);
        if (oldClose && closeBtn) closeBtn.removeEventListener('click', oldClose);
        if (oldOverlay && overlay) overlay.removeEventListener('click', oldOverlay);
        
        const closeDialog = () => {
            dialog.style.display = 'none';
        };
        
        const confirmHandler = () => {
            closeDialog();
            if (onConfirm) {
                onConfirm();
            }
        };
        
        const cancelHandler = () => {
            closeDialog();
            if (onCancel) {
                onCancel();
            }
        };
        
        confirmBtn.addEventListener('click', confirmHandler);
        cancelBtn.addEventListener('click', cancelHandler);
        if (closeBtn) {
            closeBtn.addEventListener('click', cancelHandler);
        }
        if (overlay) {
            const overlayHandler = (e) => {
                if (e.target === overlay) {
                    cancelHandler();
                }
            };
            overlay.addEventListener('click', overlayHandler);
            overlay._overlayHandler = overlayHandler;
        }
        
        confirmBtn._confirmHandler = confirmHandler;
        cancelBtn._cancelHandler = cancelHandler;
        if (closeBtn) closeBtn._closeHandler = cancelHandler;
        
        setTimeout(() => {
            cancelBtn.focus();
        }, 50);
    }
    
    closeNewCollectionDialog() {
        const dialog = document.getElementById('newCollectionDialog');
        if (dialog) {
            dialog.style.display = 'none';
            const gameNameInput = document.getElementById('newCollectionGameName');
            const gameVersionInput = document.getElementById('newCollectionGameVersion');
            const nameInput = document.getElementById('newCollectionName');
            const descInput = document.getElementById('newCollectionDescription');
            if (gameNameInput) gameNameInput.value = '';
            if (gameVersionInput) gameVersionInput.value = '';
            if (nameInput) nameInput.value = '';
            if (descInput) descInput.value = '';
        }
    }

    populateBaseClassDropdown() {
        const dropdown = document.getElementById('newCollectionBaseClass');
        if (!dropdown) return;
        
        dropdown.innerHTML = '<option value="">Select base class...</option>';
        
        const classes = [];
        if (this.app.indexes && this.app.indexes.classes) {
            this.app.indexes.classes.forEach((item, name) => {
                const chain = window.inheritanceViewer ? window.inheritanceViewer.getInheritanceInfo(item) : null;
                if (chain && chain.length > 0) {
                    classes.push({ name, chain, item });
                } else {
                    classes.push({ name, chain: [name], item });
                }
            });
        }
        
        classes.sort((a, b) => {
            if (a.chain.length !== b.chain.length) {
                return a.chain.length - b.chain.length;
            }
            return a.name.localeCompare(b.name);
        });
        
        const rootClasses = classes.filter(c => c.chain.length === 1 || c.chain.length === 0);
        rootClasses.forEach(c => {
            const option = document.createElement('option');
            option.value = c.name;
            option.textContent = c.name;
            if (c.name === 'UObject') {
                option.selected = true;
            }
            dropdown.appendChild(option);
        });
        
        classes.filter(c => c.chain.length > 1).forEach(c => {
            const option = document.createElement('option');
            option.value = c.name;
            option.textContent = c.name;
            dropdown.appendChild(option);
        });
    }

    async createNewCollection() {
        try {
            const gameNameInput = document.getElementById('newCollectionGameName');
            const gameVersionInput = document.getElementById('newCollectionGameVersion');
            const nameInput = document.getElementById('newCollectionName');
            
            if (!gameNameInput || !gameVersionInput || !nameInput) {
                this.app.showToast('Form inputs not found. Please refresh the page.', 'error');
                return;
            }
            
            const gameName = gameNameInput.value.trim();
            const gameVersion = gameVersionInput.value.trim();
            const collectionName = nameInput.value.trim();
            const dumpInfo = this.getDumpTimestamp();

            if (!gameName || !gameVersion || !collectionName) {
                this.app.showToast('Please fill in all required fields (Game Name, Game Version, and Collection Name)', 'error');
                return;
            }

            if (!window.collectionStorage) {
                this.app.showToast('Collection storage not available. Please refresh the page.', 'error');
                return;
            }

            const collection = {
                gameName: gameName,
                gameVersion: gameVersion,
                collectionName: collectionName,
                dumpDate: dumpInfo.date,
                members: [],
                classes: [],
                enums: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const result = await window.collectionStorage.saveCollection(collection);
            if (result && result.success) {
                this.app.showToast(`Collection "${collectionName}" created successfully`, 'success');
                this.closeNewCollectionDialog();
                if (document.getElementById('offsetsCollectionModal') && 
                    document.getElementById('offsetsCollectionModal').style.display !== 'none') {
                    await this.loadCollections();
                }
                await this.updateOffsetsBadge();
            } else {
                const errorMsg = result && result.error ? result.error : 'Unknown error';
                this.app.showToast(`Failed to create collection: ${errorMsg}`, 'error');
            }
        } catch (error) {
            this.app.showToast(`Error creating collection: ${error.message}`, 'error');
        }
    }

    async loadCollections() {
        if (!window.collectionStorage) return;

        const gameFilter = document.getElementById('offsetsGameFilter');
        const selectedGame = gameFilter ? gameFilter.value : 'all';
        
        let collections = await window.collectionStorage.loadCollections();
        
        if (selectedGame !== 'all') {
            const [gameName, gameVersion] = selectedGame.split('::');
            collections = await window.collectionStorage.getCollectionsByGame(gameName, gameVersion);
        }

        await this.populateGameFilter();
        this.displayCollections(collections);
    }

    async populateGameFilter() {
        if (!window.collectionStorage) return;

        const filter = document.getElementById('offsetsGameFilter');
        if (!filter) return;

        const games = await window.collectionStorage.getAllGames();
        const currentValue = filter.value;

        filter.innerHTML = '<option value="all">All Games</option>';
        
        games.forEach(game => {
            const option = document.createElement('option');
            option.value = `${game.gameName}::${game.gameVersion}`;
            option.textContent = `${game.gameName} ${game.gameVersion} (${game.collectionCount})`;
            filter.appendChild(option);
        });

        if (currentValue) {
            filter.value = currentValue;
        }

        filter.onchange = () => {
            this.loadCollections();
        };
    }

    async displayCollections(collections) {
        const list = document.getElementById('offsetsCollectionList');
        if (!list) return;

        if (collections.length === 0) {
            list.innerHTML = '<div class="empty-state-main"><p>No collections found. Create a new collection to get started.</p></div>';
            return;
        }

        for (const collection of collections) {
            if (!collection.members || collection.members.length === 0) {
                if (collection.classes && collection.classes.length > 0) {
                    collection.classes = [];
                    await window.collectionStorage.saveCollection(collection);
                }
            } else {
                const classNamesWithMembers = new Set(collection.members.map(m => m.className));
                const originalClassCount = collection.classes ? collection.classes.length : 0;
                collection.classes = (collection.classes || []).filter(c => classNamesWithMembers.has(c.className));
                if (collection.classes.length !== originalClassCount) {
                    await window.collectionStorage.saveCollection(collection);
                }
            }
        }

        let html = '';
        collections.forEach(collection => {
            const conflictCheck = window.collectionStorage.checkConflicts(collection);
            const realConflicts = conflictCheck.conflicts.filter(c => 
                c.type === 'member_missing' || c.type === 'class_missing'
            );
            const hasConflicts = realConflicts.length > 0;
            const conflictCount = realConflicts.length;

            html += `<div class="offsets-collection-item" data-collection-id="${escapeHtml(collection.id)}">`;
            html += `<div class="offsets-collection-item-header">`;
            html += `<div>`;
            html += `<div class="offsets-collection-item-name">${escapeHtml(collection.collectionName)}`;
            if (hasConflicts) {
                html += `<span class="offsets-collection-item-badge conflict">${conflictCount} Conflict${conflictCount !== 1 ? 's' : ''}</span>`;
            }
            html += `</div>`;
            html += `<div class="offsets-collection-item-meta">`;
            html += `<span>${escapeHtml(collection.gameName)} ${escapeHtml(collection.gameVersion)}</span>`;
            html += `<span>Updated: ${new Date(collection.updatedAt).toLocaleDateString()}</span>`;
            html += `</div>`;
            html += `</div>`;
            html += `<div class="offsets-collection-item-actions">`;
            html += `<button class="btn btn-small btn-secondary" data-action="edit" data-collection-id="${escapeHtml(collection.id)}">Edit</button>`;
            html += `<button class="btn btn-small btn-primary" data-action="generate" data-collection-id="${escapeHtml(collection.id)}">Generate</button>`;
            html += `<button class="btn btn-small btn-secondary" data-action="export" data-collection-id="${escapeHtml(collection.id)}">Export</button>`;
            html += `<button class="btn btn-small btn-danger" data-action="delete" data-collection-id="${escapeHtml(collection.id)}">Delete</button>`;
            html += `</div>`;
            html += `</div>`;
            html += `<div class="offsets-collection-item-stats">`;
            html += `<span>${collection.members.length} member${collection.members.length !== 1 ? 's' : ''}</span>`;
            html += `<span>${collection.classes.length} class${collection.classes.length !== 1 ? 'es' : ''}</span>`;
            if (collection.enums && collection.enums.length > 0) {
                html += `<span>${collection.enums.length} enum${collection.enums.length !== 1 ? 's' : ''}</span>`;
            }
            html += `</div>`;
            html += `</div>`;
        });

        list.innerHTML = html;

        list.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.getAttribute('data-action');
                const collectionId = btn.getAttribute('data-collection-id');
                this.handleCollectionAction(action, collectionId);
            });
        });
    }

    handleCollectionAction(action, collectionId) {
        if (!window.collectionStorage) return;

        switch (action) {
            case 'edit':
                this.editCollection(collectionId);
                break;
            case 'generate':
                this.generateCollectionCode(collectionId);
                break;
            case 'delete':
                this.showConfirmDialog(
                    'Delete Collection',
                    'Are you sure you want to delete this collection? This action cannot be undone.',
                    async () => {
                        const result = await window.collectionStorage.deleteCollection(collectionId);
                        if (result.success) {
                            this.app.showToast('Collection deleted', 'success');
                            await this.loadCollections();
                            this.updateOffsetsBadge();
                            if (this.app && this.app.refreshMemberCheckmarks) {
                                await this.app.refreshMemberCheckmarks();
                            }
                        } else {
                            this.app.showToast(`Failed to delete: ${result.error}`, 'error');
                        }
                    }
                );
                break;
            case 'export':
                this.exportCollection(collectionId);
                break;
        }
    }

    async editCollection(collectionId) {
        try {
            if (!window.collectionStorage) {
                this.app.showToast('Collection storage not available', 'error');
                return;
            }
            
            const collection = await window.collectionStorage.getCollectionById(collectionId);
            if (!collection) {
                this.app.showToast('Collection not found', 'error');
                return;
            }
            
            const conflictCheck = window.collectionStorage.checkConflicts(collection);
            
            if (conflictCheck.hasConflicts) {
                this.showConflictResolution(collection, conflictCheck.conflicts);
            } else {
                this.showCollectionMembers(collection);
            }
        } catch (error) {
            this.app.showToast(`Error: ${error.message}`, 'error');
        }
    }

    async generateCollectionCode(collectionId) {
        try {
            if (!window.collectionStorage || !window.offsetsGenerator) {
                this.app.showToast('Code generation not available', 'error');
                return;
            }
            
            const collection = await window.collectionStorage.getCollectionById(collectionId);
            if (!collection) {
                this.app.showToast('Collection not found', 'error');
                return;
            }
            
            if (collection.members.length === 0) {
                this.app.showToast('Collection has no members', 'info');
                return;
            }
            
            this.showCodeGenerationDialog(collection);
        } catch (error) {
            this.app.showToast(`Error: ${error.message}`, 'error');
        }
    }

    importCollection() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';
        
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const jsonData = event.target.result;
                        const parsedCollection = JSON.parse(jsonData);
                        
                        if (!parsedCollection.collectionName) {
                            this.app.showToast('Invalid collection format: missing collection name', 'error');
                            return;
                        }
                        
                        const existingCollections = await window.collectionStorage.loadCollections();
                        const duplicate = existingCollections.find(c => 
                            c.collectionName === parsedCollection.collectionName &&
                            c.gameName === parsedCollection.gameName &&
                            c.gameVersion === parsedCollection.gameVersion
                        );
                        
                        if (duplicate) {
                            this.showImportConflictDialog(parsedCollection, duplicate, jsonData);
                        } else {
                            const result = await window.collectionStorage.importCollection(jsonData);
                            
                            if (result.success) {
                                this.app.showToast('Collection imported successfully', 'success');
                                await this.loadCollections();
                                this.updateOffsetsBadge();
                            } else {
                                this.app.showToast(`Failed to import: ${result.error}`, 'error');
                            }
                        }
                    } catch (error) {
                        this.app.showToast(`Failed to import: ${error.message}`, 'error');
                    }
                };
                reader.onerror = () => {
                    this.app.showToast('Failed to read file', 'error');
                };
                reader.readAsText(file);
            } catch (error) {
                this.app.showToast(`Failed to import: ${error.message}`, 'error');
            } finally {
                document.body.removeChild(input);
            }
        });
        
        document.body.appendChild(input);
        input.click();
    }

    async showImportConflictDialog(newCollection, existingCollection, jsonData) {
        const existingCollections = await window.collectionStorage.loadCollections();
        const baseName = newCollection.collectionName;
        const namePattern = new RegExp(`^${escapeRegex(baseName)}(?: (\\d+))?$`);
        
        let maxNumber = 0;
        existingCollections.forEach(c => {
            const match = c.collectionName.match(namePattern);
            if (match) {
                const num = match[1] ? parseInt(match[1], 10) : 1;
                if (num > maxNumber) {
                    maxNumber = num;
                }
            }
        });
        
        const nextNumber = maxNumber + 1;
        const suggestedName = `${baseName} ${nextNumber}`;
        
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.style.display = 'flex';
        dialog.innerHTML = `
            <div class="confirm-dialog-overlay"></div>
            <div class="confirm-dialog-content">
                <div class="confirm-dialog-header">
                    <h3>Collection Already Exists</h3>
                    <button class="confirm-dialog-close">×</button>
                </div>
                <div class="confirm-dialog-body">
                    <p>A collection named "<strong>${escapeHtml(newCollection.collectionName)}</strong>" already exists for this game.</p>
                    <p>What would you like to do?</p>
                </div>
                <div class="confirm-dialog-actions" style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button class="btn btn-secondary" id="importCancelBtn">Cancel</button>
                    <button class="btn btn-primary" id="importCreateNewBtn">Create "${escapeHtml(suggestedName)}"</button>
                    <button class="btn btn-danger" id="importOverwriteBtn">Overwrite</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        const closeDialog = () => {
            document.body.removeChild(dialog);
        };
        
        document.getElementById('importOverwriteBtn').addEventListener('click', async () => {
            await window.collectionStorage.deleteCollection(existingCollection.id);
            const result = await window.collectionStorage.importCollection(jsonData);
            
            if (result.success) {
                this.app.showToast('Collection overwritten successfully', 'success');
                await this.loadCollections();
                this.updateOffsetsBadge();
            } else {
                this.app.showToast(`Failed to overwrite: ${result.error}`, 'error');
            }
            closeDialog();
        });
        
        document.getElementById('importCreateNewBtn').addEventListener('click', async () => {
            const modifiedCollection = JSON.parse(jsonData);
            modifiedCollection.collectionName = suggestedName;
            const result = await window.collectionStorage.importCollection(JSON.stringify(modifiedCollection));
            
            if (result.success) {
                this.app.showToast(`Collection imported as "${suggestedName}"`, 'success');
                await this.loadCollections();
                this.updateOffsetsBadge();
            } else {
                this.app.showToast(`Failed to import: ${result.error}`, 'error');
            }
            closeDialog();
        });
        
        document.getElementById('importCancelBtn').addEventListener('click', closeDialog);
        dialog.querySelector('.confirm-dialog-close').addEventListener('click', closeDialog);
        dialog.querySelector('.confirm-dialog-overlay').addEventListener('click', closeDialog);
    }

    async exportCollection(collectionId) {
        if (!window.collectionStorage) {
            this.app.showToast('Collection storage not available', 'error');
            return;
        }
        
        const collection = await window.collectionStorage.getCollectionById(collectionId);
        if (!collection) {
            this.app.showToast('Collection not found', 'error');
            return;
        }
        
        const jsonData = await window.collectionStorage.exportCollection(collectionId);
        if (!jsonData) {
            this.app.showToast('Failed to export collection', 'error');
            return;
        }
        
        const cleanName = (collection.collectionName || 'collection').replace(/[^a-z0-9]/gi, '_');
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${cleanName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.app.showToast('Collection exported successfully', 'success');
    }

    extractGameInfoFromPath(folderPath) {
        if (!folderPath) {
            return { gameName: null, gameVersion: null, success: false };
        }

        const pathParts = folderPath.split(/[/\\]/);
        const folderName = pathParts[pathParts.length - 1];
        
        const match = folderName.match(/^([\d.]+(?:-\d+)?)\+\+\+([^+]+)(?:\+(.+))?$/);
        
        if (match) {
            const gameVersion = match[1];
            const gameName = match[2];
            return {
                gameName: gameName,
                gameVersion: gameVersion,
                success: true
            };
        }
        
        for (const part of pathParts) {
            const fallbackMatch = part.match(/^([\d.]+(?:-\d+)?)\+\+\+([^+]+)/);
            if (fallbackMatch) {
                return {
                    gameName: fallbackMatch[2],
                    gameVersion: fallbackMatch[1],
                    success: true
                };
            }
        }
        
        return { gameName: null, gameVersion: null, success: false };
    }

    getDumpTimestamp() {
        if (this.app.data.offsets && this.app.data.offsets.updated_at) {
            const timestamp = parseInt(this.app.data.offsets.updated_at);
            if (!isNaN(timestamp)) {
                const date = new Date(timestamp);
                return {
                    timestamp: timestamp,
                    date: date.toISOString().split('T')[0],
                    formatted: date.toLocaleString()
                };
            }
        }
        
        const now = new Date();
        return {
            timestamp: now.getTime(),
            date: now.toISOString().split('T')[0],
            formatted: now.toLocaleString()
        };
    }

    async updateOffsetsBadge() {
        try {
            if (!window.collectionStorage) return;
            
            const collections = await window.collectionStorage.loadCollections();
            const badge = document.getElementById('navOffsetsBadge');
            if (badge) {
                if (collections && collections.length > 0) {
                    badge.textContent = collections.length;
                    badge.style.display = 'inline-flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        } catch (error) {
            console.warn('Failed to update offsets badge:', error);
        }
    }

    showCollectionMembers(collection) {
        try {
            const modal = document.createElement('div');
            modal.className = 'collection-members-modal';
            modal.innerHTML = `
                <div class="collection-members-modal-overlay"></div>
                <div class="collection-members-modal-content">
                    <div class="collection-members-header">
                        <h3>${escapeHtml(collection.collectionName)} - Members</h3>
                        <button class="collection-members-close">×</button>
                    </div>
                    <div class="collection-members-body">
                        <div class="collection-members-info">
                            <p><strong>Game:</strong> ${escapeHtml(collection.gameName)} ${escapeHtml(collection.gameVersion)}</p>
                            <p><strong>Members:</strong> ${collection.members.length} | <strong>Enums:</strong> ${collection.enums ? collection.enums.length : 0}</p>
                        </div>
                        ${collection.members.length > 0 ? `
                        <h4 style="margin-top: 1rem; margin-bottom: 0.5rem; color: var(--text-primary);">Members</h4>
                        <table class="members-table">
                            <thead>
                                <tr>
                                    <th>Class</th>
                                    <th>Member</th>
                                    <th>Type</th>
                                    <th>Offset</th>
                                    <th>Size</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="collectionMembersTableBody">
                            </tbody>
                        </table>
                        ` : ''}
                        ${collection.enums && collection.enums.length > 0 ? `
                        <h4 style="margin-top: ${collection.members.length > 0 ? '2rem' : '1rem'}; margin-bottom: 0.5rem; color: var(--text-primary);">Enums</h4>
                        <table class="members-table">
                            <thead>
                                <tr>
                                    <th>Enum Name</th>
                                    <th>Underlying Type</th>
                                    <th>Values</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="collectionEnumsTableBody">
                            </tbody>
                        </table>
                        ` : ''}
                        ${collection.members.length === 0 && (!collection.enums || collection.enums.length === 0) ? `
                        <div class="empty-state" style="padding: 2rem; text-align: center; color: var(--text-muted);">
                            <p>No members or enums in this collection.</p>
                        </div>
                        ` : ''}
                    </div>
                    <div class="collection-members-actions">
                        <button class="btn btn-secondary collection-members-close-btn">Close</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.style.display = 'flex';
            
            const tbody = modal.querySelector('#collectionMembersTableBody');
            if (tbody) {
                collection.members.forEach(member => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${escapeHtml(member.className)}</td>
                        <td>${escapeHtml(member.memberName)}</td>
                        <td>${escapeHtml(member.memberType)}</td>
                        <td>${formatOffset(member.offset)}</td>
                        <td>${member.size || 0}</td>
                        <td>
                            <button class="btn btn-small btn-danger" data-action="remove-member" data-member-key="${escapeHtml(member.className)}::${escapeHtml(member.memberName)}">Remove</button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            }
            
            const enumsTbody = modal.querySelector('#collectionEnumsTableBody');
            if (enumsTbody && collection.enums && collection.enums.length > 0) {
                collection.enums.forEach(enumData => {
                    const row = document.createElement('tr');
                    const valuesText = enumData.values.map(v => `${v.name} = ${v.value}`).join(', ');
                    const valuesDisplay = valuesText.length > 100 ? valuesText.substring(0, 100) + '...' : valuesText;
                    row.innerHTML = `
                        <td>${escapeHtml(enumData.enumName)}</td>
                        <td>${escapeHtml(enumData.underlyingType || 'uint8')}</td>
                        <td title="${escapeHtml(valuesText)}" style="max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(valuesDisplay)}</td>
                        <td>
                            <button class="btn btn-small btn-danger" data-action="remove-enum" data-enum-name="${escapeHtml(enumData.enumName)}">Remove</button>
                        </td>
                    `;
                    enumsTbody.appendChild(row);
                });
            }
            
            const closeBtn = modal.querySelector('.collection-members-close');
            const closeBtn2 = modal.querySelector('.collection-members-close-btn');
            const overlay = modal.querySelector('.collection-members-modal-overlay');
            
            const closeModal = () => {
                document.body.removeChild(modal);
            };
            
            closeBtn.addEventListener('click', closeModal);
            closeBtn2.addEventListener('click', closeModal);
            overlay.addEventListener('click', closeModal);
            
            modal.querySelectorAll('[data-action="remove-member"]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const memberKey = btn.getAttribute('data-member-key');
                    const [className, memberName] = memberKey.split('::');
                    
                    collection.members = collection.members.filter(m => 
                        !(m.className === className && m.memberName === memberName)
                    );
                    
                    if (collection.members.length === 0) {
                        collection.classes = [];
                    } else {
                        const classNamesWithMembers = new Set(collection.members.map(m => m.className));
                        collection.classes = (collection.classes || []).filter(c => classNamesWithMembers.has(c.className));
                    }
                    
                    await window.collectionStorage.saveCollection(collection);
                    this.app.showToast('Member removed', 'success');
                    this.refreshCollectionMembersModal(modal, collection);
                    if (this.app && this.app.refreshMemberCheckmarks) {
                        await this.app.refreshMemberCheckmarks();
                    }
                });
            });
        } catch (error) {
            this.app.showToast(`Error: ${error.message}`, 'error');
        }
    }
    
    refreshCollectionMembersModal(modal, collection) {
        const membersTableEl = modal.querySelector('.members-table');
        if (membersTableEl) {
            const thead = membersTableEl.querySelector('thead tr');
            if (thead) {
                const hasSizeColumn = Array.from(thead.querySelectorAll('th')).some(th => th.textContent.trim() === 'Size');
                if (!hasSizeColumn) {
                    const offsetHeader = thead.querySelector('th:nth-child(4)');
                    if (offsetHeader) {
                        const sizeHeader = document.createElement('th');
                        sizeHeader.textContent = 'Size';
                        offsetHeader.insertAdjacentElement('afterend', sizeHeader);
                    }
                }
            }
        }
        
        const infoSection = modal.querySelector('.collection-members-info');
        if (infoSection) {
            const memberCountP = infoSection.querySelector('p:last-child');
            if (memberCountP) {
                memberCountP.innerHTML = `<strong>Members:</strong> ${collection.members.length} | <strong>Enums:</strong> ${collection.enums ? collection.enums.length : 0}`;
            }
        }
        
        const tbody = modal.querySelector('#collectionMembersTableBody');
        if (tbody) {
            tbody.innerHTML = '';
            if (collection.members.length > 0) {
                collection.members.forEach(member => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${escapeHtml(member.className)}</td>
                        <td>${escapeHtml(member.memberName)}</td>
                        <td>${escapeHtml(member.memberType)}</td>
                        <td>${formatOffset(member.offset)}</td>
                        <td>${member.size || 0}</td>
                        <td>
                            <button class="btn btn-small btn-danger" data-action="remove-member" data-member-key="${escapeHtml(member.className)}::${escapeHtml(member.memberName)}">Remove</button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
                
                modal.querySelectorAll('[data-action="remove-member"]').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const memberKey = btn.getAttribute('data-member-key');
                        const [className, memberName] = memberKey.split('::');
                        
                        collection.members = collection.members.filter(m => 
                            !(m.className === className && m.memberName === memberName)
                        );
                        
                        if (collection.members.length === 0) {
                            collection.classes = [];
                        } else {
                            const classNamesWithMembers = new Set(collection.members.map(m => m.className));
                            collection.classes = (collection.classes || []).filter(c => classNamesWithMembers.has(c.className));
                        }
                        
                        await window.collectionStorage.saveCollection(collection);
                        this.app.showToast('Member removed', 'success');
                        this.refreshCollectionMembersModal(modal, collection);
                        if (this.app && this.app.refreshMemberCheckmarks) {
                            await this.app.refreshMemberCheckmarks();
                        }
                    });
                });
            }
        }
        
        const enumsTbody = modal.querySelector('#collectionEnumsTableBody');
        if (enumsTbody) {
            enumsTbody.innerHTML = '';
            if (collection.enums && collection.enums.length > 0) {
                collection.enums.forEach(enumData => {
                    const row = document.createElement('tr');
                    const valuesText = enumData.values.map(v => `${v.name} = ${v.value}`).join(', ');
                    const valuesDisplay = valuesText.length > 100 ? valuesText.substring(0, 100) + '...' : valuesText;
                    row.innerHTML = `
                        <td>${escapeHtml(enumData.enumName)}</td>
                        <td>${escapeHtml(enumData.underlyingType || 'uint8')}</td>
                        <td title="${escapeHtml(valuesText)}" style="max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(valuesDisplay)}</td>
                        <td>
                            <button class="btn btn-small btn-danger" data-action="remove-enum" data-enum-name="${escapeHtml(enumData.enumName)}">Remove</button>
                        </td>
                    `;
                    enumsTbody.appendChild(row);
                });
                
                modal.querySelectorAll('[data-action="remove-enum"]').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const enumName = btn.getAttribute('data-enum-name');
                        
                        if (!collection.enums) {
                            collection.enums = [];
                        }
                        
                        collection.enums = collection.enums.filter(e => e.enumName !== enumName);
                        
                        await window.collectionStorage.saveCollection(collection);
                        this.app.showToast(`Enum ${enumName} removed`, 'success');
                        this.refreshCollectionMembersModal(modal, collection);
                        if (this.app && this.app.refreshMemberCheckmarks) {
                            await this.app.refreshMemberCheckmarks();
                        }
                    });
                });
            }
        }
        
        const membersTable = modal.querySelector('#collectionMembersTableBody')?.closest('table');
        const enumsTable = modal.querySelector('#collectionEnumsTableBody')?.closest('table');
        const membersHeader = membersTable?.previousElementSibling;
        const enumsHeader = enumsTable?.previousElementSibling;
        
        if (membersTable) {
            membersTable.style.display = collection.members.length > 0 ? 'table' : 'none';
            if (membersHeader && membersHeader.tagName === 'H4') {
                membersHeader.style.display = collection.members.length > 0 ? 'block' : 'none';
            }
        }
        
        if (enumsTable) {
            enumsTable.style.display = (collection.enums && collection.enums.length > 0) ? 'table' : 'none';
            if (enumsHeader && enumsHeader.tagName === 'H4') {
                enumsHeader.style.display = (collection.enums && collection.enums.length > 0) ? 'block' : 'none';
            }
        }
        
        const body = modal.querySelector('.collection-members-body');
        let emptyState = body?.querySelector('.empty-state');
        if (collection.members.length === 0 && (!collection.enums || collection.enums.length === 0)) {
            if (!emptyState) {
                emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.style.cssText = 'padding: 2rem; text-align: center; color: var(--text-muted);';
                emptyState.innerHTML = '<p>No members or enums in this collection.</p>';
                body?.appendChild(emptyState);
            }
        } else if (emptyState) {
            emptyState.remove();
        }
    }

    showConflictResolution(collection, conflicts) {
        const modal = document.createElement('div');
        modal.className = 'conflict-resolution-modal';
        modal.innerHTML = `
            <div class="conflict-resolution-modal-overlay"></div>
            <div class="conflict-resolution-modal-content">
                <div class="conflict-resolution-header">
                    <h3>Resolve Conflicts: ${escapeHtml(collection.collectionName)}</h3>
                    <button class="conflict-resolution-close">×</button>
                </div>
                <div class="conflict-resolution-body">
                    <p>Found ${conflicts.length} conflict(s) in this collection:</p>
                    <div id="conflictsList"></div>
                </div>
                <div class="conflict-resolution-actions">
                    <button class="btn btn-secondary" id="removeAllMissingBtn">Remove All Missing</button>
                    <button class="btn btn-secondary conflict-resolution-close-btn">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'flex';
        
        const conflictsList = modal.querySelector('#conflictsList');
        conflicts.forEach((conflict, index) => {
            const conflictItem = document.createElement('div');
            conflictItem.className = 'conflict-item';
            conflictItem.innerHTML = `
                <div class="conflict-info">
                    <strong>${escapeHtml(conflict.member.className)}::${escapeHtml(conflict.member.memberName)}</strong>
                    <span class="conflict-type">${escapeHtml(conflict.type)}</span>
                </div>
                <div class="conflict-message">${escapeHtml(conflict.message)}</div>
                <div class="conflict-actions">
                    <button class="btn btn-small btn-danger" data-action="remove" data-conflict-index="${index}">Remove</button>
                    ${conflict.type === 'offset_changed' || conflict.type === 'type_changed' ? 
                        `<button class="btn btn-small btn-primary" data-action="update" data-conflict-index="${index}">Update</button>` : 
                        ''}
                </div>
            `;
            conflictsList.appendChild(conflictItem);
        });
        
        const closeBtn = modal.querySelector('.conflict-resolution-close');
        const closeBtn2 = modal.querySelector('.conflict-resolution-close-btn');
        const overlay = modal.querySelector('.conflict-resolution-modal-overlay');
        
        const closeModal = () => {
            document.body.removeChild(modal);
        };
        
        closeBtn.addEventListener('click', closeModal);
        closeBtn2.addEventListener('click', closeModal);
        overlay.addEventListener('click', closeModal);
        
        const removeAllMissingBtn = modal.querySelector('#removeAllMissingBtn');
        removeAllMissingBtn.addEventListener('click', async () => {
            const missingConflicts = conflicts.filter(c => c.type === 'member_missing' || c.type === 'class_missing');
            missingConflicts.forEach(conflict => {
                collection.members = collection.members.filter(m => 
                    !(m.className === conflict.member.className && m.memberName === conflict.member.memberName)
                );
            });
            
            if (collection.members.length === 0) {
                collection.classes = [];
            } else {
                const classNamesWithMembers = new Set(collection.members.map(m => m.className));
                collection.classes = (collection.classes || []).filter(c => classNamesWithMembers.has(c.className));
            }
            
            await window.collectionStorage.saveCollection(collection);
            this.app.showToast(`Removed ${missingConflicts.length} missing member(s)`, 'success');
            closeModal();
            await this.loadCollections();
            if (this.app && this.app.refreshMemberCheckmarks) {
                await this.app.refreshMemberCheckmarks();
            }
        });
        
        modal.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const action = btn.getAttribute('data-action');
                const index = parseInt(btn.getAttribute('data-conflict-index'));
                const conflict = conflicts[index];
                
                if (action === 'remove') {
                    collection.members = collection.members.filter(m => 
                        !(m.className === conflict.member.className && m.memberName === conflict.member.memberName)
                    );
                    
                    if (collection.members.length === 0) {
                        collection.classes = [];
                    } else {
                        const classNamesWithMembers = new Set(collection.members.map(m => m.className));
                        collection.classes = (collection.classes || []).filter(c => classNamesWithMembers.has(c.className));
                    }
                    
                    await window.collectionStorage.saveCollection(collection);
                    this.app.showToast('Member removed', 'success');
                    closeModal();
                    await this.loadCollections();
                    if (this.app && this.app.refreshMemberCheckmarks) {
                        await this.app.refreshMemberCheckmarks();
                    }
                } else if (action === 'update') {
                    const member = collection.members.find(m => 
                        m.className === conflict.member.className && m.memberName === conflict.member.memberName
                    );
                    if (member) {
                        if (conflict.currentOffset !== undefined) {
                            member.offset = conflict.currentOffset;
                        }
                        if (conflict.currentType) {
                            member.memberType = conflict.currentType;
                        }
                    }
                    await window.collectionStorage.saveCollection(collection);
                    this.app.showToast('Member updated', 'success');
                    closeModal();
                    await this.loadCollections();
                    if (this.app && this.app.refreshMemberCheckmarks) {
                        await this.app.refreshMemberCheckmarks();
                    }
                }
            });
        });
    }

    showCodeGenerationDialog(collection) {
        try {
            const dialog = document.createElement('div');
            dialog.className = 'code-generation-dialog';
            dialog.innerHTML = `
                <div class="code-generation-dialog-overlay"></div>
                <div class="code-generation-dialog-content">
                    <div class="code-generation-header">
                        <h3>Generate Code for ${escapeHtml(collection.collectionName)}</h3>
                        <button class="code-generation-close">×</button>
                    </div>
                    <div class="code-generation-body">
                        <div class="code-generation-field">
                            <label>Language:</label>
                            <select id="codeGenLanguage">
                                <option value="cpp">C++</option>
                                <option value="csharp">C#</option>
                            </select>
                        </div>
                        <div class="code-generation-field">
                            <label>Main Namespace:</label>
                            <input type="text" id="codeGenMainNamespace" value="Offsets" placeholder="e.g., Offsets">
                        </div>
                        <div class="code-generation-field">
                            <label>Namespace Style:</label>
                            <select id="codeGenNamespaceStyle">
                                <option value="nested">Nested</option>
                                <option value="flat" selected>Flat</option>
                            </select>
                        </div>
                    </div>
                    <div class="code-generation-actions">
                        <button class="btn btn-secondary code-generation-cancel">Cancel</button>
                        <button class="btn btn-primary code-generation-generate">Generate</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(dialog);
            dialog.style.display = 'flex';
            
            const closeBtn = dialog.querySelector('.code-generation-close');
            const cancelBtn = dialog.querySelector('.code-generation-cancel');
            const overlay = dialog.querySelector('.code-generation-dialog-overlay');
            
            const closeDialog = () => {
                document.body.removeChild(dialog);
            };
            
            closeBtn.addEventListener('click', closeDialog);
            cancelBtn.addEventListener('click', closeDialog);
            overlay.addEventListener('click', closeDialog);
            
            const generateBtn = dialog.querySelector('.code-generation-generate');
            generateBtn.addEventListener('click', () => {
                const language = document.getElementById('codeGenLanguage').value;
                const mainNamespace = document.getElementById('codeGenMainNamespace').value.trim() || 'Offsets';
                const namespaceStyle = document.getElementById('codeGenNamespaceStyle').value;
                
                const options = {
                    format: language,
                    offsetType: 'relative',
                    namespaceStyle: namespaceStyle,
                    mainNamespace: mainNamespace
                };
                
                const code = window.offsetsGenerator.generateFromCollection(collection, options);
                this.showGeneratedCode(code, collection.collectionName, language);
                closeDialog();
            });
        } catch (error) {
            this.app.showToast(`Error: ${error.message}`, 'error');
        }
    }

    showGeneratedCode(code, collectionName, language) {
        const ext = language === 'csharp' ? 'cs' : 'cpp';
        const filename = `${collectionName}.${ext}`;
        
        const modal = document.createElement('div');
        modal.className = 'generated-code-modal';
        modal.innerHTML = `
            <div class="generated-code-modal-overlay"></div>
            <div class="generated-code-modal-content">
                <div class="generated-code-header">
                    <h3>Generated Code: ${escapeHtml(collectionName)}</h3>
                    <button class="generated-code-close">×</button>
                </div>
                <div class="generated-code-actions">
                    <button class="btn btn-primary" id="copyGeneratedCodeBtn">Copy</button>
                    <button class="btn btn-secondary" id="saveGeneratedCodeBtn">Save File</button>
                </div>
                <div class="generated-code-body">
                    <pre class="code-block" id="generatedCodeDisplay"><code>${window.codeGenerator ? window.codeGenerator.highlightCode(code) : escapeHtml(code)}</code></pre>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'flex';
        
        const closeBtn = modal.querySelector('.generated-code-close');
        const overlay = modal.querySelector('.generated-code-modal-overlay');
        
        const closeModal = () => {
            document.body.removeChild(modal);
        };
        
        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', closeModal);
        
        const copyBtn = modal.querySelector('#copyGeneratedCodeBtn');
        copyBtn.addEventListener('click', async () => {
            try {
                if (window.electronAPI && window.electronAPI.copyToClipboard) {
                    await window.electronAPI.copyToClipboard(code);
                } else {
                    await navigator.clipboard.writeText(code);
                }
                this.app.showToast('Code copied to clipboard', 'success');
            } catch (error) {
                this.app.showToast(`Failed to copy: ${error.message}`, 'error');
            }
        });
        
        const saveBtn = modal.querySelector('#saveGeneratedCodeBtn');
        saveBtn.addEventListener('click', async () => {
            try {
                if (window.electronAPI && window.electronAPI.saveFile) {
                    const result = await window.electronAPI.saveFile(code, filename);
                    if (result.success) {
                        this.app.showToast(`Code saved to ${result.path}`, 'success');
                    } else {
                        const errorMsg = result.error || 'Save cancelled or failed';
                        this.app.showToast(`Failed to save: ${errorMsg}`, 'error');
                    }
                } else {
                    this.app.showToast('File saving not available in this environment', 'error');
                }
            } catch (error) {
                this.app.showToast(`Failed to save: ${error.message}`, 'error');
            }
        });
    }

    async showMemberContextMenu(event, row, className, member) {
        this.hideMemberContextMenu();
        
        if (!window.collectionStorage) return;
        
        const collections = await window.collectionStorage.loadCollections();
        const isInCollection = await this.isMemberInCollection(className, member.name);
        
        const contextMenu = document.createElement('div');
        contextMenu.className = 'member-context-menu';
        contextMenu.id = 'memberContextMenu';
        
        let html = '<div class="context-menu-header">Add to Collection</div>';
        
        if (collections.length === 0) {
            html += '<div class="context-menu-item" data-action="new">Create New Collection...</div>';
        } else {
            collections.forEach(collection => {
                const isInThisCollection = collection.members.some(m => 
                    m.className === className && m.memberName === member.name
                );
                if (isInThisCollection) {
                    html += `<div class="context-menu-item disabled" title="Already in this collection">${escapeHtml(collection.collectionName)} ✓</div>`;
                } else {
                    html += `<div class="context-menu-item" data-action="add" data-collection-id="${escapeHtml(collection.id)}">${escapeHtml(collection.collectionName)}</div>`;
                }
            });
            html += '<div class="context-menu-divider"></div>';
            html += '<div class="context-menu-item" data-action="new">Create New Collection...</div>';
        }
        
        contextMenu.innerHTML = html;
        document.body.appendChild(contextMenu);
        
        const x = event.clientX;
        const y = event.clientY;
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        
        setTimeout(() => {
            const rect = contextMenu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                contextMenu.style.left = `${window.innerWidth - rect.width - 10}px`;
            }
            if (rect.bottom > window.innerHeight) {
                contextMenu.style.top = `${window.innerHeight - rect.height - 10}px`;
            }
        }, 0);
        
        contextMenu.querySelectorAll('.context-menu-item[data-action]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.getAttribute('data-action');
                if (action === 'new') {
                    this.showNewCollectionDialog();
                    this.hideMemberContextMenu();
                } else if (action === 'add') {
                    const collectionId = item.getAttribute('data-collection-id');
                    this.addMemberToCollection(className, member, collectionId);
                    this.hideMemberContextMenu();
                }
            });
        });
        
        this.app.currentContextMenu = contextMenu;
    }

    hideMemberContextMenu() {
        const contextMenu = document.getElementById('memberContextMenu');
        if (contextMenu) {
            contextMenu.remove();
        }
        this.app.currentContextMenu = null;
    }

    async showClassContextMenu(event, item) {
        this.hideMemberContextMenu();
        
        if (!window.collectionStorage) return;
        
        const className = item.name || item.data?.name;
        if (!className) return;
        
        const members = this.getCurrentClassMembers(item);
        if (!members || members.length === 0) {
            this.app.showToast('No members found in this class', 'info');
            return;
        }
        
        const collections = await window.collectionStorage.loadCollections();
        
        const contextMenu = document.createElement('div');
        contextMenu.className = 'member-context-menu';
        contextMenu.id = 'classContextMenu';
        
        let html = `<div class="context-menu-header">Add All Members (${members.length}) to Collection</div>`;
        
        if (collections.length === 0) {
            html += '<div class="context-menu-item" data-action="new">Create New Collection...</div>';
        } else {
            collections.forEach(collection => {
                const existingCount = collection.members.filter(m => m.className === className).length;
                const remainingCount = members.length - existingCount;
                
                if (existingCount === members.length) {
                    html += `<div class="context-menu-item disabled" title="All members already in this collection">${escapeHtml(collection.collectionName)} ✓</div>`;
                } else if (existingCount > 0) {
                    html += `<div class="context-menu-item" data-action="add-all" data-collection-id="${escapeHtml(collection.id)}">${escapeHtml(collection.collectionName)} (${remainingCount} new)</div>`;
                } else {
                    html += `<div class="context-menu-item" data-action="add-all" data-collection-id="${escapeHtml(collection.id)}">${escapeHtml(collection.collectionName)}</div>`;
                }
            });
            html += '<div class="context-menu-divider"></div>';
            html += '<div class="context-menu-item" data-action="new">Create New Collection...</div>';
        }
        
        contextMenu.innerHTML = html;
        document.body.appendChild(contextMenu);
        
        const x = event.clientX;
        const y = event.clientY;
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        
        setTimeout(() => {
            const rect = contextMenu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                contextMenu.style.left = `${window.innerWidth - rect.width - 10}px`;
            }
            if (rect.bottom > window.innerHeight) {
                contextMenu.style.top = `${window.innerHeight - rect.height - 10}px`;
            }
        }, 0);
        
        contextMenu.querySelectorAll('.context-menu-item[data-action]').forEach(menuItem => {
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = menuItem.getAttribute('data-action');
                if (action === 'new') {
                    this.showNewCollectionDialog();
                    this.hideClassContextMenu();
                } else if (action === 'add-all') {
                    const collectionId = menuItem.getAttribute('data-collection-id');
                    this.addAllMembersToCollection(className, members, collectionId);
                    this.hideClassContextMenu();
                }
            });
        });
        
        this.app.currentClassContextMenu = contextMenu;
    }
    
    hideClassContextMenu() {
        if (this.app.currentClassContextMenu) {
            document.body.removeChild(this.app.currentClassContextMenu);
            this.app.currentClassContextMenu = null;
        }
    }

    async showEnumContextMenu(event, item) {
        this.hideMemberContextMenu();
        this.hideClassContextMenu();
        
        if (!window.collectionStorage) return;
        
        const enumName = item.name || item.data?.name;
        if (!enumName) return;
        
        const enumData = this.getEnumData(item);
        if (!enumData || enumData.values.length === 0) {
            this.app.showToast('No enum values found', 'info');
            return;
        }
        
        const collections = await window.collectionStorage.loadCollections();
        
        const contextMenu = document.createElement('div');
        contextMenu.className = 'member-context-menu';
        contextMenu.id = 'enumContextMenu';
        
        let html = `<div class="context-menu-header">Add Enum "${escapeHtml(enumName)}" to Collection</div>`;
        
        if (collections.length === 0) {
            html += '<div class="context-menu-item" data-action="new">Create New Collection...</div>';
        } else {
            collections.forEach(collection => {
                const isInThisCollection = collection.enums && collection.enums.some(e => e.enumName === enumName);
                
                if (isInThisCollection) {
                    html += `<div class="context-menu-item disabled" title="Already in this collection">${escapeHtml(collection.collectionName)} ✓</div>`;
                } else {
                    html += `<div class="context-menu-item" data-action="add-enum" data-collection-id="${escapeHtml(collection.id)}">${escapeHtml(collection.collectionName)}</div>`;
                }
            });
            html += '<div class="context-menu-divider"></div>';
            html += '<div class="context-menu-item" data-action="new">Create New Collection...</div>';
        }
        
        contextMenu.innerHTML = html;
        document.body.appendChild(contextMenu);
        
        const x = event.clientX;
        const y = event.clientY;
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        
        setTimeout(() => {
            const rect = contextMenu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                contextMenu.style.left = `${window.innerWidth - rect.width - 10}px`;
            }
            if (rect.bottom > window.innerHeight) {
                contextMenu.style.top = `${window.innerHeight - rect.height - 10}px`;
            }
        }, 0);
        
        contextMenu.querySelectorAll('.context-menu-item[data-action]').forEach(menuItem => {
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = menuItem.getAttribute('data-action');
                if (action === 'new') {
                    this.showNewCollectionDialog();
                    this.hideEnumContextMenu();
                } else if (action === 'add-enum') {
                    const collectionId = menuItem.getAttribute('data-collection-id');
                    this.addEnumToCollection(enumName, enumData, collectionId);
                    this.hideEnumContextMenu();
                }
            });
        });
        
        this.app.currentEnumContextMenu = contextMenu;
    }
    
    hideEnumContextMenu() {
        if (this.app.currentEnumContextMenu) {
            document.body.removeChild(this.app.currentEnumContextMenu);
            this.app.currentEnumContextMenu = null;
        }
    }
    
    getEnumData(item) {
        if (!item.data || !Array.isArray(item.data) || item.data.length < 1) {
            return null;
        }
        
        const enumValues = item.data[0];
        const underlyingType = item.data[1] || 'uint8';
        const enumName = item.name || 'Unknown';
        
        const values = [];
        if (Array.isArray(enumValues)) {
            enumValues.forEach(enumValue => {
                const entries = Object.entries(enumValue);
                entries.forEach(([name, value]) => {
                    values.push({ name, value });
                });
            });
        }
        
        return {
            enumName: enumName,
            underlyingType: underlyingType,
            values: values
        };
    }
    
    async addEnumToCollection(enumName, enumData, collectionId) {
        if (!window.collectionStorage) {
            this.app.showToast('Collection storage not available', 'error');
            return;
        }
        
        const collection = await window.collectionStorage.getCollectionById(collectionId);
        if (!collection) {
            this.app.showToast('Collection not found', 'error');
            return;
        }
        
        if (!collection.enums) {
            collection.enums = [];
        }
        
        const exists = collection.enums.some(e => e.enumName === enumName);
        if (exists) {
            this.app.showToast(`Enum ${enumName} already in collection`, 'info');
            return;
        }
        
        const enumEntry = {
            enumName: enumName,
            underlyingType: enumData.underlyingType,
            values: enumData.values,
            addedAt: new Date().toISOString()
        };
        
        collection.enums.push(enumEntry);
        
        const result = await window.collectionStorage.saveCollection(collection);
        if (result.success) {
            this.app.showToast(`Added enum ${enumName} to ${collection.collectionName}`, 'success');
            if (document.getElementById('offsetsCollectionModal') && 
                document.getElementById('offsetsCollectionModal').style.display !== 'none') {
                await this.loadCollections();
            }
            if (this.app && this.app.refreshMemberCheckmarks) {
                await this.app.refreshMemberCheckmarks();
            }
        } else {
            this.app.showToast(`Failed to add enum: ${result.error}`, 'error');
        }
    }

    getCurrentClassMembers(item) {
        if (!item.data || !Array.isArray(item.data)) {
            return [];
        }
        
        const members = [];
        for (const member of item.data) {
            if (typeof member === 'object' && member !== null) {
                const entries = Object.entries(member);
                for (const [memberName, memberData] of entries) {
                    if (memberName === '__InheritInfo' || memberName === '__MDKClassSize') {
                        continue;
                    }
                    
                    if (Array.isArray(memberData) && memberData.length >= 2) {
                        const offset = memberData[1];
                        const size = memberData[2] || 0;
                        const typeInfo = memberData[0];
                        
                        let typeStr = 'Unknown';
                        if (Array.isArray(typeInfo) && typeInfo.length > 0) {
                            typeStr = window.inheritanceViewer ? window.inheritanceViewer.formatType(typeInfo) : JSON.stringify(typeInfo);
                        } else if (typeInfo) {
                            typeStr = String(typeInfo);
                        }
                        
                        members.push({
                            name: memberName,
                            type: typeInfo,
                            offset: offset,
                            size: size
                        });
                    }
                }
            }
        }
        
        return members;
    }
    
    async addAllMembersToCollection(className, members, collectionId) {
        if (!window.collectionStorage) {
            this.app.showToast('Collection storage not available', 'error');
            return;
        }
        
        const collection = await window.collectionStorage.getCollectionById(collectionId);
        if (!collection) {
            this.app.showToast('Collection not found', 'error');
            return;
        }
        
        let addedCount = 0;
        let skippedCount = 0;
        
        for (const member of members) {
            const exists = collection.members.some(m => 
                m.className === className && m.memberName === member.name
            );
            
            if (!exists) {
                await this.addMemberToCollection(className, member, collectionId);
                addedCount++;
            } else {
                skippedCount++;
            }
        }
        
        if (addedCount > 0) {
            this.app.showToast(`Added ${addedCount} member${addedCount !== 1 ? 's' : ''} to collection${skippedCount > 0 ? ` (${skippedCount} already existed)` : ''}`, 'success');
            if (this.app && this.app.refreshMemberCheckmarks) {
                await this.app.refreshMemberCheckmarks();
            }
        } else {
            this.app.showToast('All members are already in this collection', 'info');
        }
    }

    async addMemberToCollection(className, member, collectionId) {
        if (!window.collectionStorage) {
            this.app.showToast('Collection storage not available', 'error');
            return;
        }
        
        const collection = await window.collectionStorage.getCollectionById(collectionId);
        if (!collection) {
            this.app.showToast('Collection not found', 'error');
            return;
        }
        
        const exists = collection.members.some(m => 
            m.className === className && m.memberName === member.name
        );
        
        if (exists) {
            this.app.showToast(`Member ${member.name} already in collection`, 'info');
            return;
        }
        
        const classItem = this.app.indexes.classes.get(className) || this.app.indexes.structs.get(className);
        let classInheritanceChain = [];
        if (classItem) {
            const chainInfo = window.inheritanceViewer.getInheritanceInfo(classItem);
            if (chainInfo && Array.isArray(chainInfo)) {
                classInheritanceChain = chainInfo;
            }
        }
        
        let actualType = null;
        let actualOffset = member.offset;
        let actualSize = member.size || 0;
        
        const fullInheritanceChain = window.inheritanceViewer && classItem ? window.inheritanceViewer.getFullInheritanceChain(classItem) : [className];
        
        for (const chainClassName of fullInheritanceChain) {
            const chainClassItem = this.app.indexes.classes.get(chainClassName) || this.app.indexes.structs.get(chainClassName);
            if (!chainClassItem || !chainClassItem.data || !Array.isArray(chainClassItem.data)) {
                continue;
            }
            
            for (const item of chainClassItem.data) {
                if (typeof item === 'object' && item !== null) {
                    const entries = Object.entries(item);
                    for (const [name, data] of entries) {
                        if (name === member.name && Array.isArray(data) && data.length >= 2) {
                            const typeInfo = data[0];
                            actualOffset = data[1];
                            actualSize = data[2] || 0;
                            
                            if (Array.isArray(typeInfo) && typeInfo.length > 0) {
                                actualType = window.inheritanceViewer ? window.inheritanceViewer.formatType(typeInfo) : JSON.stringify(typeInfo);
                            } else if (typeInfo) {
                                actualType = String(typeInfo);
                            }
                            
                            if (actualType) break;
                        }
                    }
                    if (actualType) break;
                }
            }
            if (actualType) break;
        }
        
        if (!actualType) {
            if (member.type) {
                if (typeof member.type === 'string' && member.type !== 'Unknown') {
                    actualType = member.type;
                } else if (Array.isArray(member.type) && member.type.length > 0) {
                    actualType = window.inheritanceViewer ? window.inheritanceViewer.formatType(member.type) : JSON.stringify(member.type);
                } else {
                    actualType = String(member.type);
                }
            }
        }
        
        if (!actualType || actualType === 'Unknown') {
            actualType = member.type || 'Unknown Type';
        }
        
        const memberData = {
            className: className,
            memberName: member.name,
            memberType: actualType,
            offset: actualOffset,
            size: actualSize
        };
        
        collection.members.push(memberData);
        
        const classExists = collection.classes.some(c => c.className === className);
        if (!classExists) {
            collection.classes.push({
                className: className,
                inheritanceChain: classInheritanceChain
            });
        }
        
        const result = await window.collectionStorage.saveCollection(collection);
        if (result.success) {
            this.app.showToast(`Added ${member.name} to ${collection.collectionName}`, 'success');
            if (this.app && this.app.refreshMemberCheckmarks) {
                await this.app.refreshMemberCheckmarks();
            }
            if (document.getElementById('offsetsCollectionModal') && 
                document.getElementById('offsetsCollectionModal').style.display !== 'none') {
                setTimeout(() => {
                    this.loadCollections();
                }, 500);
            }
        } else {
            this.app.showToast(`Failed to add member: ${result.error}`, 'error');
        }
    }

    async isMemberInCollection(className, memberName) {
        if (!window.collectionStorage) return false;
        
        const collections = await window.collectionStorage.loadCollections();
        return collections.some(collection => {
            return collection.members.some(m => 
                m.className === className && m.memberName === memberName
            );
        });
    }

    getSelectedMembers() {
        const selected = [];
        document.querySelectorAll('.member-checkbox:checked').forEach(cb => {
            const row = cb.closest('tr');
            if (row) {
                const className = row.getAttribute('data-class-name');
                const memberName = row.getAttribute('data-member-name');
                const memberType = row.getAttribute('data-member-type');
                
                const currentMembers = this.app.currentMembers || [];
                const member = currentMembers.find(m => 
                    m.name.toLowerCase() === memberName && 
                    m.type.toLowerCase() === memberType
                );
                
                if (member) {
                    selected.push({
                        className: className,
                        member: member,
                        memberKey: cb.getAttribute('data-member-key')
                    });
                }
            }
        });
        return selected;
    }

    showCollectionSelectorForSelected() {
        const selected = this.getSelectedMembers();
        if (selected.length === 0) {
            this.app.showToast('No members selected', 'info');
            return;
        }
        
        const collectionId = prompt(`Add ${selected.length} selected member(s) to which collection? (Enter collection ID or click Cancel to select from list)`);
        if (collectionId) {
            selected.forEach(({ className, member }) => {
                this.addMemberToCollection(className, member, collectionId);
            });
        } else {
            this.openOffsetsModal();
        }
    }

    addSelectedMembersToCollection(collectionId) {
        const selected = this.getSelectedMembers();
        if (selected.length === 0) {
            this.app.showToast('No members selected', 'info');
            return;
        }
        
        selected.forEach(({ className, member }) => {
            this.addMemberToCollection(className, member, collectionId);
        });
        
        this.app.showToast(`Added ${selected.length} member(s) to collection`, 'success');
        this.selectNoneMembers();
    }

    async populateMembersCollectionSelector() {
        const selector = document.getElementById('membersCollectionSelector');
        if (!selector || !window.collectionStorage) return;
        
        const collections = await window.collectionStorage.loadCollections();
        selector.innerHTML = '<option value="">Select collection...</option>';
        
        if (collections.length === 0) {
            const option = document.createElement('option');
            option.value = 'new';
            option.textContent = 'Create New Collection...';
            selector.appendChild(option);
        } else {
            collections.forEach(collection => {
                const option = document.createElement('option');
                option.value = collection.id;
                option.textContent = `${collection.collectionName} (${collection.members.length} members)`;
                selector.appendChild(option);
            });
            
            const newOption = document.createElement('option');
            newOption.value = 'new';
            newOption.textContent = 'Create New Collection...';
            selector.appendChild(newOption);
        }
        
        selector.onchange = () => {
            if (selector.value === 'new') {
                this.showNewCollectionDialog();
                selector.value = '';
            } else if (selector.value) {
                this.addSelectedMembersToCollection(selector.value);
                selector.value = '';
            }
        };
    }

    async populateRowCollectionSelector(selector) {
        if (!window.collectionStorage) return;
        
        const collections = await window.collectionStorage.loadCollections();
        selector.innerHTML = '<option value="">Add to...</option>';
        
        collections.forEach(collection => {
            const option = document.createElement('option');
            option.value = collection.id;
            option.textContent = collection.collectionName;
            selector.appendChild(option);
        });
        
        const newOption = document.createElement('option');
        newOption.value = 'new';
        newOption.textContent = 'Create New...';
        selector.appendChild(newOption);
    }

    selectAllMembers() {
        document.querySelectorAll('.member-checkbox').forEach(cb => {
            cb.checked = true;
        });
        const selectAllCheckbox = document.getElementById('membersTableSelectAll');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = true;
        }
    }

    selectNoneMembers() {
        document.querySelectorAll('.member-checkbox').forEach(cb => {
            cb.checked = false;
        });
        const selectAllCheckbox = document.getElementById('membersTableSelectAll');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
        }
    }

    selectMembersByType(type) {
        document.querySelectorAll('.member-checkbox').forEach(cb => {
            const row = cb.closest('tr');
            if (row) {
                const typeCell = row.querySelector('.member-type');
                if (typeCell && typeCell.textContent.trim() === type) {
                    cb.checked = true;
                } else {
                    cb.checked = false;
                }
            }
        });
    }

    setupBulkSelectionHandlers() {
        const selectAllBtn = document.getElementById('selectAllMembersBtn');
        const selectNoneBtn = document.getElementById('selectNoneMembersBtn');
        const selectAllCheckbox = document.getElementById('membersTableSelectAll');
        const addSelectedBtn = document.getElementById('addSelectedToCollectionBtn');
        
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.selectAllMembers();
            });
        }
        
        if (selectNoneBtn) {
            selectNoneBtn.addEventListener('click', () => {
                this.selectNoneMembers();
            });
        }
        
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const checked = e.target.checked;
                document.querySelectorAll('.member-checkbox').forEach(cb => {
                    cb.checked = checked;
                });
            });
        }
        
        if (addSelectedBtn) {
            addSelectedBtn.addEventListener('click', () => {
                this.showCollectionSelectorForSelected();
            });
        }
    }

    populateMembersTypeFilter(members) {
        const filter = document.getElementById('membersTypeFilter');
        if (!filter) return;
        
        const types = new Set();
        members.forEach(m => {
            if (m.type) {
                const typeStr = window.inheritanceViewer ? window.inheritanceViewer.formatType(m.type) : String(m.type);
                types.add(typeStr);
            }
        });
        
        filter.innerHTML = '<option value="">Select by Type...</option>';
        Array.from(types).sort().forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            filter.appendChild(option);
        });
        
        filter.onchange = () => {
            const selectedType = filter.value;
            if (selectedType) {
                this.selectMembersByType(selectedType);
            }
        };
    }
}

