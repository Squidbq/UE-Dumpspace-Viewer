class DumpspaceApp {
    constructor() {
        this.data = {
            classes: null,
            structs: null,
            functions: null,
            enums: null,
            offsets: null
        };
        this.indexes = {
            classes: new Map(),
            structs: new Map(),
            functions: new Map(),
            enums: new Map(),
            offsets: new Map()
        };
        this.searchIndexes = {
            nameIndex: new Map(),
            memberNameIndex: new Map(),
            memberTypeIndex: new Map(),
            functionParamIndex: new Map()
        };
        this.currentCategory = 'classes';
        this.currentDetailItem = null;
        this.sidebarItems = [];
        this.selectedFolderPath = null;
        this.highlightQuery = null;
        this.navigationHistory = [];
        this.navigationHistoryIndex = -1;
        this.isNavigatingHistory = false;
        this.lastNavigationTime = 0;
        this.lastSaveTime = 0;
        this.detectedGameInfo = null;
        this.selectedMembers = new Set();
        this.currentMembers = [];
        this.currentContextMenu = null;
        this.currentClassContextMenu = null;
        this.memberSearchQuery = '';
        this.memberSearchMatches = [];
        this.memberSearchCurrentIndex = -1;
        this.advancedSearchQuery = '';
        this.advancedSearchTimeout = null;
        this.maxAdvancedSearchResults = 500;
        this.preprocessedData = {
            inheritanceChains: new Map(),
            childrenLookup: new Map(),
            functionsByClass: new Map(),
            paramsByClass: new Map()
        };
        this.toastContainer = null;
        this.navigation = new NavigationManager(this);
        this.collections = new CollectionManager(this);
        this.init();
    }

    async init() {
        this.toastContainer = document.getElementById('toastContainer');
        this.setupEventListeners();
        this.setupGlobalTypeLinkHandlers();
        
        const savedFolder = await window.electronAPI.getSelectedFolder();
        if (savedFolder) {
            this.selectedFolderPath = savedFolder;
            await this.startLoading();
        } else {
            this.showFolderSelection();
        }
    }

    setupGlobalTypeLinkHandlers() {
        const self = this;
        document.addEventListener('click', function(e) {
            const link = e.target.closest('.type-link');
            if (link) {
                e.preventDefault();
                e.stopPropagation();
                const typeName = link.getAttribute('data-type');
                if (typeName) {
                    self.navigateToType(typeName);
                }
            }
        });
    }

    showFolderSelection() {
        document.getElementById('folderSelectionScreen').style.display = 'flex';
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('mainLayout').style.display = 'none';
        const topNav = document.getElementById('topNav');
        if (topNav) {
            topNav.style.display = 'none';
        }
    }

    showError(message) {
        const errorDisplay = document.getElementById('errorDisplay');
        if (errorDisplay) {
            errorDisplay.innerHTML = message.split('\n').map(line => 
                line.trim() ? `<div>${line.trim()}</div>` : ''
            ).join('');
            errorDisplay.style.display = 'block';
        }
        
        const loadingErrorDisplay = document.getElementById('loadingErrorDisplay');
        if (loadingErrorDisplay) {
            loadingErrorDisplay.innerHTML = message.split('\n').map(line => 
                line.trim() ? `<div>${line.trim()}</div>` : ''
            ).join('');
            loadingErrorDisplay.style.display = 'block';
        }
    }

    showFileStatus(fileStatus) {
        if (!fileStatus || fileStatus.length === 0) return;
        
        const missingCount = fileStatus.filter(f => !f.exists).length;
        const foundCount = fileStatus.filter(f => f.exists).length;
        
        const fileList = fileStatus.map(file => {
            if (file.exists) {
                return `<div class="file-status-item file-status-found">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    <span>${escapeHtml(file.filename)}</span>
                </div>`;
            } else {
                return `<div class="file-status-item file-status-missing">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M15 9l-6 6M9 9l6 6"/>
                    </svg>
                    <span>${escapeHtml(file.filename)}</span>
                </div>`;
            }
        }).join('');
        
        const errorDisplay = document.getElementById('errorDisplay');
        if (errorDisplay) {
            errorDisplay.innerHTML = `
                <div class="file-status-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 8v4M12 16h.01"/>
                    </svg>
                    <span>File Status (${foundCount} found, ${missingCount} missing)</span>
                </div>
                <div class="file-status-list">
                    ${fileList}
                </div>
                <div class="file-status-note">
                    ${missingCount > 0 
                        ? 'Please ensure all required files are present before loading.' 
                        : 'All required files are present. Ready to load.'}
                </div>
            `;
            errorDisplay.style.display = 'block';
            errorDisplay.classList.add('file-status-display');
        }
        
        const loadingErrorDisplay = document.getElementById('loadingErrorDisplay');
        if (loadingErrorDisplay) {
            loadingErrorDisplay.innerHTML = `
                <div class="file-status-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 8v4M12 16h.01"/>
                    </svg>
                    <span>File Status (${foundCount} found, ${missingCount} missing)</span>
                </div>
                <div class="file-status-list">
                    ${fileList}
                </div>
                <div class="file-status-note">
                    ${missingCount > 0 
                        ? 'Please ensure all required files are present before loading.' 
                        : 'All required files are present. Ready to load.'}
                </div>
            `;
            loadingErrorDisplay.style.display = 'block';
            loadingErrorDisplay.classList.add('file-status-display');
        }
    }

    showMissingFiles(missingFiles) {
        if (!missingFiles || missingFiles.length === 0) return;
        
        const errorDisplay = document.getElementById('errorDisplay');
        if (errorDisplay) {
            const fileList = missingFiles.map(filename => 
                `<div class="missing-file-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 8v4M12 16h.01"/>
                    </svg>
                    <span>${escapeHtml(filename)}</span>
                </div>`
            ).join('');
            
            errorDisplay.innerHTML = `
                <div class="missing-files-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 8v4M12 16h.01"/>
                    </svg>
                    <span>Missing Files (${missingFiles.length})</span>
                </div>
                <div class="missing-files-list">
                    ${fileList}
                </div>
                <div class="missing-files-note">
                    These files were not found in the selected folder. Please ensure all required files are present before loading.
                </div>
            `;
            errorDisplay.style.display = 'block';
            errorDisplay.classList.add('missing-files-display');
        }
        
        const loadingErrorDisplay = document.getElementById('loadingErrorDisplay');
        if (loadingErrorDisplay) {
            const fileList = missingFiles.map(filename => 
                `<div class="missing-file-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 8v4M12 16h.01"/>
                    </svg>
                    <span>${escapeHtml(filename)}</span>
                </div>`
            ).join('');
            
            loadingErrorDisplay.innerHTML = `
                <div class="missing-files-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 8v4M12 16h.01"/>
                    </svg>
                    <span>Missing Files (${missingFiles.length})</span>
                </div>
                <div class="missing-files-list">
                    ${fileList}
                </div>
                <div class="missing-files-note">
                    These files were not found in the selected folder. Please ensure all required files are present before loading.
                </div>
            `;
            loadingErrorDisplay.style.display = 'block';
            loadingErrorDisplay.classList.add('missing-files-display');
        }
    }

    clearError() {
        const errorDisplay = document.getElementById('errorDisplay');
        if (errorDisplay) {
            errorDisplay.style.display = 'none';
            errorDisplay.textContent = '';
            errorDisplay.classList.remove('missing-files-display');
            errorDisplay.classList.remove('file-status-display');
        }
        
        const loadingErrorDisplay = document.getElementById('loadingErrorDisplay');
        if (loadingErrorDisplay) {
            loadingErrorDisplay.style.display = 'none';
            loadingErrorDisplay.textContent = '';
            loadingErrorDisplay.classList.remove('missing-files-display');
            loadingErrorDisplay.classList.remove('file-status-display');
        }
    }

    async selectFolder() {
        try {
            this.clearError();
            const result = await window.electronAPI.selectFolder();
            if (result.success) {
                this.selectedFolderPath = result.path;
                document.getElementById('selectedFolderPath').textContent = result.path;
                document.getElementById('selectedFolderPath').style.display = 'block';
                
                const allFilesExist = await this.checkAllFilesExist();
                if (allFilesExist) {
                await this.startLoading();
                } else {
                    this.showFolderSelection();
                }
            }
        } catch (error) {
            console.error('Error selecting folder:', error);
            this.showError(`Error selecting folder: ${error.message}`);
        }
    }

    async checkAllFilesExist() {
        const requiredFiles = [
            'ClassesInfo.json',
            'StructsInfo.json',
            'FunctionsInfo.json',
            'EnumsInfo.json',
            'OffsetsInfo.json'
        ];
        
        try {
            const result = await window.electronAPI.checkFilesExist(requiredFiles, this.selectedFolderPath);
            
            if (result && result.success) {
                return true;
            } else {
                const fileStatus = result?.results || requiredFiles.map(f => ({ filename: f, exists: false }));
                this.showFileStatus(fileStatus);
                return false;
            }
        } catch (error) {
            this.showError(`Error checking files: ${error.message}`);
            return false;
        }
    }

    async startLoading() {
        document.getElementById('folderSelectionScreen').style.display = 'none';
        document.getElementById('loadingScreen').style.display = 'flex';
        document.getElementById('mainLayout').style.display = 'none';

        try {
            const success = await this.loadData();
            if (success) {
        this.updateTimestamp();
        this.hideLoading();
        this.showNavigation();
        this.loadCategory('classes');
            }
        } catch (error) {
            this.showError('Failed to load data. Please try again.');
            this.showFolderSelection();
        }
    }

    updateProgress(percent, status, title = null) {
        const progressBar = document.getElementById('progressBarFill');
        const progressText = document.getElementById('progressText');
        const loadingStatus = document.getElementById('loadingStatus');
        const loadingTitle = document.getElementById('loadingTitle');

        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
        if (progressText) {
            progressText.textContent = `${Math.round(percent)}%`;
        }
        if (loadingStatus) {
            loadingStatus.textContent = status;
        }
        if (loadingTitle && title) {
            loadingTitle.textContent = title;
        }
    }

    async loadData() {
        const files = [
            { key: 'classes', filename: 'ClassesInfo.json' },
            { key: 'structs', filename: 'StructsInfo.json' },
            { key: 'functions', filename: 'FunctionsInfo.json' },
            { key: 'enums', filename: 'EnumsInfo.json' },
            { key: 'offsets', filename: 'OffsetsInfo.json' }
        ];

        try {
            this.clearError();
            this.updateProgress(0, 'Loading JSON files...', 'Loading Data Files');
            
            const loadPromises = files.map((file, index) => 
                window.electronAPI.loadJSONFile(file.filename, this.selectedFolderPath)
                    .then(result => {
                        if (result && result.success) {
                        this.updateProgress((index + 1) * 10, `Loaded ${file.filename}...`, 'Loading Data Files');
                            return { key: file.key, data: result.data, success: true };
                        } else {
                            return { key: file.key, data: null, success: false, error: result?.error || 'Unknown error' };
                        }
                    })
                    .catch(error => {
                        return { key: file.key, data: null, success: false, error: error.message || 'Unknown error' };
                    })
            );

            const results = await Promise.all(loadPromises);
            
            const loadedFiles = results.filter(r => r.success);
            const failedFiles = results.filter(r => !r.success);
            
            if (failedFiles.length > 0) {
                const missingFiles = failedFiles.map(r => {
                    const file = files.find(f => f.key === r.key);
                    return file ? file.filename : r.key;
                });
                this.showMissingFiles(missingFiles);
                throw new Error(`Failed to load ${failedFiles.length} file(s). All files must be loaded successfully.`);
            }
            
            loadedFiles.forEach(({ key, data }) => {
                this.data[key] = data;
            });

            this.updateProgress(60, 'Building indexes...', 'Indexing Data');
            
            let indexProgress = 60;
            for (let i = 0; i < loadedFiles.length; i++) {
                const { key, data } = loadedFiles[i];
                await this.buildIndexChunked(key, data);
                indexProgress += 5;
                this.updateProgress(indexProgress, `Indexed ${key}...`, 'Indexing Data');
            }
            
            this.updateProgress(85, 'Building search indexes...', 'Building Search Index');
            
            await this.buildSearchIndexes();
            
            this.updateProgress(92, 'Preprocessing inheritance chains...', 'Preprocessing Data');
            
            await this.preprocessAdvancedSearchData();
            
            this.updateProgress(100, 'Complete!', 'Ready');
            
            await new Promise(resolve => setTimeout(resolve, 300));
            
            return true;
            
        } catch (error) {
            this.showError('Failed to load all required files. Please ensure all JSON files are present in the selected folder.');
            this.showFolderSelection();
            return false;
        }
    }

    async buildIndexChunked(key, jsonData) {
        const index = this.indexes[key];
        const dataArray = jsonData.data || [];
        const chunkSize = 500;

        if (key === 'classes' || key === 'structs') {
            for (let i = 0; i < dataArray.length; i += chunkSize) {
                const chunk = dataArray.slice(i, i + chunkSize);
                chunk.forEach(item => {
                    const entries = Object.entries(item);
                    entries.forEach(([name, value]) => {
                        if (Array.isArray(value)) {
                            const normalizedType = key === 'classes' ? 'class' : 'struct';
                            index.set(name, { name, data: value, type: normalizedType });
                        }
                    });
                });
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        } else if (key === 'functions') {
            for (let i = 0; i < dataArray.length; i += chunkSize) {
                const chunk = dataArray.slice(i, i + chunkSize);
                chunk.forEach(item => {
                    const entries = Object.entries(item);
                    entries.forEach(([className, functions]) => {
                        if (Array.isArray(functions)) {
                            functions.forEach(funcData => {
                                const funcEntries = Object.entries(funcData);
                                funcEntries.forEach(([funcName, funcInfo]) => {
                                    if (Array.isArray(funcInfo)) {
                                        const key = `${className}::${funcName}`;
                                        index.set(key, {
                                            className,
                                            funcName,
                                            data: funcInfo,
                                            type: 'function'
                                        });
                                    }
                                });
                            });
                        }
                    });
                });
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        } else if (key === 'enums') {
            for (let i = 0; i < dataArray.length; i += chunkSize) {
                const chunk = dataArray.slice(i, i + chunkSize);
                chunk.forEach(item => {
                    const entries = Object.entries(item);
                    entries.forEach(([enumName, enumData]) => {
                        if (Array.isArray(enumData)) {
                            index.set(enumName, { name: enumName, data: enumData, type: 'enum' });
                        }
                    });
                });
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        } else if (key === 'offsets') {
            if (jsonData.data && Array.isArray(jsonData.data)) {
                for (let i = 0; i < jsonData.data.length; i += chunkSize) {
                    const chunk = jsonData.data.slice(i, i + chunkSize);
                    chunk.forEach(offsetItem => {
                        if (Array.isArray(offsetItem) && offsetItem.length >= 2) {
                            const name = offsetItem[0];
                            const value = offsetItem[1];
                            index.set(name, { name, value, type: 'offset' });
                        }
                    });
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
        }
    }

    async buildSearchIndexes() {
        const chunkSize = 500;
        const categories = Object.entries(this.indexes);
        let totalItems = 0;
        let processedItems = 0;
        
        categories.forEach(([category, index]) => {
            totalItems += index.size;
        });
        
        for (const [category, index] of categories) {
            const items = Array.from(index.values());
            
            for (let i = 0; i < items.length; i += chunkSize) {
                const chunk = items.slice(i, i + chunkSize);
                
                processedItems += chunk.length;
                let progress = 85;
                if (totalItems > 0) {
                    progress = 85 + (processedItems / totalItems) * 14;
                    progress = Math.min(99, progress);
                } else {
                    progress = 99;
                }
                this.updateProgress(progress, `Indexing ${category}... (${processedItems}/${totalItems})`, 'Building Search Index');
                
                chunk.forEach(item => {
                    const originalName = item.name || item.funcName || item.className || '';
                    const name = originalName.toLowerCase();
                    if (name) {
                        this.addToSearchIndex(this.searchIndexes.nameIndex, name, item);
                        
                        const words = originalName
                            .replace(/([A-Z])/g, ' $1')
                            .split(/[\s_0-9]+/)
                            .map(w => w.toLowerCase())
                            .filter(w => w.length >= 2);
                        
                        words.forEach(word => {
                            this.addToSearchIndex(this.searchIndexes.nameIndex, word, item);
                        });
                        
                        for (let len = 3; len <= Math.min(6, name.length); len++) {
                            const prefix = name.substring(0, len);
                            this.addToSearchIndex(this.searchIndexes.nameIndex, prefix, item);
                        }
                    }

                    const itemType = item.type || item.searchType;
                    if ((itemType === 'class' || itemType === 'classes' || itemType === 'struct' || itemType === 'structs') 
                        && item.data && Array.isArray(item.data)) {
                        for (const member of item.data) {
                            if (typeof member === 'object' && member !== null) {
                                const entries = Object.entries(member);
                                for (const [memberName, memberData] of entries) {
                                    if (memberName === '__InheritInfo' || memberName === '__MDKClassSize') {
                                        continue;
                                    }

                                    const memberNameLower = memberName.toLowerCase();
                                    this.addToSearchIndex(this.searchIndexes.memberNameIndex, memberNameLower, item);
                                    
                                    if (Array.isArray(memberData) && memberData.length > 0) {
                                        const typeInfo = memberData[0];
                                        if (Array.isArray(typeInfo) && typeInfo.length > 0) {
                                            const typeName = typeInfo[0];
                                            if (typeof typeName === 'string') {
                                                const typeNameLower = typeName.toLowerCase();
                                                this.addToSearchIndex(this.searchIndexes.memberTypeIndex, typeNameLower, item);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if ((itemType === 'class' || itemType === 'struct') && item.data && Array.isArray(item.data)) {
                        const fullInheritanceChain = this.getFullInheritanceChainRecursive(item);
                        if (fullInheritanceChain && fullInheritanceChain.length > 0) {
                            fullInheritanceChain.forEach(inheritedClass => {
                                if (typeof inheritedClass === 'string' && inheritedClass !== item.name) {
                                    const inheritedClassLower = inheritedClass.toLowerCase();
                                    this.addToSearchIndex(this.searchIndexes.nameIndex, inheritedClassLower, item);
                                }
                            });
                        }
                    }

                    if (itemType === 'enum' && item.data && Array.isArray(item.data) && item.data.length >= 1) {
                        const enumValues = item.data[0];
                        if (Array.isArray(enumValues)) {
                            enumValues.forEach(enumValue => {
                                const entries = Object.entries(enumValue);
                                entries.forEach(([enumName]) => {
                                    const enumNameLower = enumName.toLowerCase();
                                    this.addToSearchIndex(this.searchIndexes.nameIndex, enumNameLower, item);
                                });
                            });
                        }
                    }

                    const funcItemType = item.type || item.searchType;
                    if (funcItemType === 'function' && item.data && Array.isArray(item.data)) {
                        if (item.data.length > 1) {
                            const params = item.data[1];
                            if (Array.isArray(params)) {
                                for (const param of params) {
                                    if (Array.isArray(param) && param.length >= 3) {
                                        const paramType = param[0];
                                        const paramName = param[2];
                                        
                                        if (Array.isArray(paramType) && paramType.length > 0) {
                                            const typeName = paramType[0];
                                            if (typeof typeName === 'string' && typeName.trim()) {
                                                this.addToSearchIndex(this.searchIndexes.functionParamIndex, typeName.toLowerCase(), item);
                                            }
                                        }
                                        
                                        if (typeof paramName === 'string' && paramName.trim()) {
                                            this.addToSearchIndex(this.searchIndexes.functionParamIndex, paramName.toLowerCase(), item);
                                        }
                                    }
                                }
                            }
                        }
                    }
                });

                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        this.updateProgress(100, 'Complete!', 'Ready');
    }

    async preprocessAdvancedSearchData() {
        const allClasses = Array.from(this.indexes.classes.values());
        const allStructs = Array.from(this.indexes.structs.values());
        const allItems = [...allClasses, ...allStructs];
        
        const directParents = new Map();
        const directChildren = new Map();
        
        allItems.forEach(item => {
            const className = item.name || item.className;
            if (!className) return;
            
            if (item.data && Array.isArray(item.data)) {
                for (const member of item.data) {
                    if (typeof member === 'object' && member !== null) {
                        const entries = Object.entries(member);
                        for (const [memberName, memberData] of entries) {
                            if (memberName === '__InheritInfo' && Array.isArray(memberData)) {
                                if (!directParents.has(className)) {
                                    directParents.set(className, new Set());
                                }
                                memberData.forEach(parentName => {
                                    if (typeof parentName === 'string') {
                                        directParents.get(className).add(parentName);
                                        
                                        if (!directChildren.has(parentName)) {
                                            directChildren.set(parentName, new Set());
                                        }
                                        directChildren.get(parentName).add(className);
                                    }
                                });
                                break;
                            }
                        }
                    }
                }
            }
        });
        
        const chunkSize = 1000;
        let processed = 0;
        const total = allItems.length;
        
        const parentCache = new Map();
        const getParentsRecursive = (className) => {
            if (parentCache.has(className)) {
                return parentCache.get(className);
            }
            
            const parents = new Set();
            const direct = directParents.get(className);
            if (direct) {
                direct.forEach(parent => {
                    parents.add(parent);
                    const grandParents = getParentsRecursive(parent);
                    grandParents.forEach(gp => parents.add(gp));
                });
            }
            
            const result = Array.from(parents);
            parentCache.set(className, result);
            return result;
        };
        
        const childCache = new Map();
        const getChildrenRecursive = (className) => {
            if (childCache.has(className)) {
                return childCache.get(className);
            }
            
            const children = new Set();
            const direct = directChildren.get(className);
            if (direct) {
                direct.forEach(child => {
                    children.add(child);
                    const grandChildren = getChildrenRecursive(child);
                    grandChildren.forEach(gc => children.add(gc));
                });
            }
            
            const result = Array.from(children);
            childCache.set(className, result);
            return result;
        };
        
        for (let i = 0; i < allItems.length; i += chunkSize) {
            const chunk = allItems.slice(i, i + chunkSize);
            
            chunk.forEach(item => {
                const className = item.name || item.className;
                if (!className) return;
                
                const parents = getParentsRecursive(className);
                const children = getChildrenRecursive(className);
                
                this.preprocessedData.inheritanceChains.set(className, {
                    parents: parents,
                    children: children
                });
            });
            
            processed += chunk.length;
            const progress = 92 + (processed / total) * 8;
            this.updateProgress(Math.min(99, progress), `Preprocessing ${processed}/${total}...`, 'Preprocessing Data');
            
            if (i % (chunkSize * 5) === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        await this.preprocessFunctionsAndParams();
    }
    
    async preprocessFunctionsAndParams() {
        if (!this.indexes.functions) return;
        
        const chunkSize = 500;
        const allFunctions = Array.from(this.indexes.functions.values());
        let processed = 0;
        const total = allFunctions.length;
        
        for (let i = 0; i < allFunctions.length; i += chunkSize) {
            const chunk = allFunctions.slice(i, i + chunkSize);
            
            chunk.forEach(funcItem => {
                const className = funcItem.className;
                if (!className) return;
                
                if (!this.preprocessedData.functionsByClass.has(className)) {
                    this.preprocessedData.functionsByClass.set(className, []);
                }
                this.preprocessedData.functionsByClass.get(className).push({
                    funcName: funcItem.funcName || '',
                    funcItem: funcItem
                });
                
                if (funcItem.data && Array.isArray(funcItem.data) && funcItem.data.length > 1) {
                    const params = funcItem.data[1];
                    if (Array.isArray(params)) {
                        for (const param of params) {
                            if (Array.isArray(param) && param.length >= 3) {
                                const paramType = param[0];
                                const paramName = param[2] || '';
                                
                                let paramTypeStr = 'Unknown';
                                if (Array.isArray(paramType) && paramType.length > 0) {
                                    paramTypeStr = window.inheritanceViewer.formatType(paramType);
                                }
                                
                                if (!this.preprocessedData.paramsByClass.has(className)) {
                                    this.preprocessedData.paramsByClass.set(className, []);
                                }
                                this.preprocessedData.paramsByClass.get(className).push({
                                    functionName: funcItem.funcName || '',
                                    name: paramName,
                                    typeStr: paramTypeStr
                                });
                            }
                        }
                    }
                }
            });
            
            processed += chunk.length;
            const progress = 99 + (processed / total) * 0.5;
            this.updateProgress(Math.min(99.5, progress), `Preprocessing functions... ${processed}/${total}`, 'Preprocessing Data');
            
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }


    getInheritancePathToClass(fromClassName, toClassName) {
        if (fromClassName === toClassName) {
            return [fromClassName];
        }
        
        const fromChain = this.preprocessedData.inheritanceChains.get(fromClassName);
        if (!fromChain) return [];
        
        const isInChain = fromChain.parents.includes(toClassName) || 
                         fromChain.children.includes(toClassName) ||
                         fromClassName === toClassName;
        
        if (!isInChain) {
            return [];
        }
        
        const visited = new Set();
        const queue = [[fromClassName]];
        
        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];
            
            if (current === toClassName) {
                return path;
            }
            
            if (visited.has(current)) continue;
            visited.add(current);
            
            const chain = this.preprocessedData.inheritanceChains.get(current);
            if (!chain) continue;
            
            for (const parent of chain.parents) {
                if (parent === toClassName) {
                    return [...path, toClassName];
                }
                if (!visited.has(parent)) {
                    queue.push([...path, parent]);
                }
            }
            
            for (const child of chain.children) {
                if (child === toClassName) {
                    return [...path, toClassName];
                }
                if (!visited.has(child)) {
                    queue.push([...path, child]);
                }
            }
        }
        
        return [];
    }

    addToSearchIndex(index, term, item) {
        if (!index.has(term)) {
            index.set(term, new Set());
        }
        index.get(term).add(item);
    }

    getFullInheritanceChainRecursive(item) {
        const chain = new Set();
        const visited = new Set();
        
        const traverse = (currentItem) => {
            if (!currentItem || !currentItem.data || !Array.isArray(currentItem.data)) {
                return;
            }
            
            const itemName = currentItem.name || currentItem.className;
            if (itemName && visited.has(itemName)) {
                return;
            }
            if (itemName) {
                visited.add(itemName);
            }
            
            for (const member of currentItem.data) {
                if (typeof member === 'object' && member !== null) {
                    const entries = Object.entries(member);
                    for (const [memberName, memberData] of entries) {
                        if (memberName === '__InheritInfo' && Array.isArray(memberData)) {
                            memberData.forEach(parentName => {
                                if (typeof parentName === 'string') {
                                    chain.add(parentName);
                                    
                                    const parentItem = this.indexes.classes.get(parentName) || 
                                                       this.indexes.structs.get(parentName);
                                    if (parentItem) {
                                        traverse(parentItem);
                                    }
                                }
                            });
                            return;
                        }
                    }
                }
            }
        };
        
        traverse(item);
        return Array.from(chain);
    }

    setupEventListeners() {
        const navSelectFolderBtn = document.getElementById('navSelectFolderBtn');
        if (navSelectFolderBtn) {
            navSelectFolderBtn.addEventListener('click', () => {
                this.selectFolder();
            });
        }

        const navGenerateOffsetsBtn = document.getElementById('navGenerateOffsetsBtn');
        if (navGenerateOffsetsBtn) {
            navGenerateOffsetsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.collections && this.collections.openOffsetsModal) {
                    this.collections.openOffsetsModal();
                } else {
                    console.error('openOffsetsModal method not found');
                }
            });
        } else {
            console.warn('navGenerateOffsetsBtn not found');
        }

        const offsetsCollectionClose = document.getElementById('offsetsCollectionClose');
        if (offsetsCollectionClose) {
            offsetsCollectionClose.addEventListener('click', () => {
                this.collections.closeOffsetsModal();
            });
        }

        const newCollectionBtn = document.getElementById('newCollectionBtn');
        if (newCollectionBtn) {
            newCollectionBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.collections && this.collections.showNewCollectionDialog) {
                    this.collections.showNewCollectionDialog();
                } else {
                    console.error('showNewCollectionDialog method not found');
                }
            });
        } else {
            console.warn('newCollectionBtn not found');
        }

        const newCollectionClose = document.getElementById('newCollectionClose');
        const newCollectionCancel = document.getElementById('newCollectionCancel');
        if (newCollectionClose) {
            newCollectionClose.addEventListener('click', () => {
                this.collections.closeNewCollectionDialog();
            });
        }
        if (newCollectionCancel) {
            newCollectionCancel.addEventListener('click', () => {
                this.collections.closeNewCollectionDialog();
            });
        }

        const newCollectionCreate = document.getElementById('newCollectionCreate');
        if (newCollectionCreate) {
            newCollectionCreate.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.collections && this.collections.createNewCollection) {
                    this.collections.createNewCollection();
                } else {
                    console.error('createNewCollection method not found');
                }
            });
        } else {
            console.warn('newCollectionCreate not found');
        }

        const importCollectionBtn = document.getElementById('importCollectionBtn');
        if (importCollectionBtn) {
            importCollectionBtn.addEventListener('click', () => {
                this.collections.importCollection();
            });
        }

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('offsets-collection-modal-overlay') && 
                !e.target.closest('.offsets-collection-modal-content')) {
                this.collections.closeOffsetsModal();
            }
            const newCollectionDialog = document.getElementById('newCollectionDialog');
            if (newCollectionDialog && newCollectionDialog.style.display !== 'none') {
                const overlay = newCollectionDialog.querySelector('.new-collection-dialog-overlay');
                const content = newCollectionDialog.querySelector('.new-collection-dialog-content');
                if (e.target === overlay || (overlay && overlay.contains(e.target) && !content.contains(e.target))) {
                    this.collections.closeNewCollectionDialog();
                }
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.closest('#navGenerateOffsetsBtn')) {
                e.preventDefault();
                e.stopPropagation();
                if (this.collections && this.collections.openOffsetsModal) {
                    this.collections.openOffsetsModal();
                }
                return;
            }
            
            if (e.target.closest('#newCollectionBtn')) {
                e.preventDefault();
                e.stopPropagation();
                if (this.collections && this.collections.showNewCollectionDialog) {
                    this.collections.showNewCollectionDialog();
                }
                return;
            }
            
            if (e.target.closest('#newCollectionCreate')) {
                e.preventDefault();
                e.stopPropagation();
                if (this.collections && this.collections.createNewCollection) {
                    this.collections.createNewCollection();
                }
                return;
            }
            
            if (e.target.closest('#offsetsCollectionClose')) {
                if (this.collections && this.collections.closeOffsetsModal) {
                    this.collections.closeOffsetsModal();
                }
                return;
            }
            
            if (e.target.closest('#newCollectionClose') || e.target.closest('#newCollectionCancel')) {
                if (this.closeNewCollectionDialog) {
                    this.collections.closeNewCollectionDialog();
                }
                return;
            }
        });
        const selectFolderBtn = document.getElementById('selectFolderBtn');
        if (selectFolderBtn) {
            selectFolderBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await this.selectFolder();
            });
        }

        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const category = e.target.getAttribute('data-category');
                if (category === 'search') {
                    this.openGlobalSearch();
                } else {
                    this.switchCategory(category);
                }
            });
        });

        const sidebarSearchInput = document.getElementById('sidebarSearchInput');
        const clearSidebarSearchBtn = document.getElementById('clearSidebarSearchBtn');
        
        sidebarSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            this.filterSidebarItems(query);
            if (query) {
                clearSidebarSearchBtn.classList.add('visible');
            } else {
                clearSidebarSearchBtn.classList.remove('visible');
            }
        });

        clearSidebarSearchBtn.addEventListener('click', () => {
            sidebarSearchInput.value = '';
            clearSidebarSearchBtn.classList.remove('visible');
            this.filterSidebarItems('');
        });

        document.querySelectorAll('.detail-tab').forEach(tab => {
            tab.addEventListener('click', async (e) => {
                const tabName = e.target.getAttribute('data-tab');
                await this.switchDetailTab(tabName);
            });
        });

        const globalSearchModal = document.getElementById('globalSearchModal');
        const globalSearchInput = document.getElementById('globalSearchInput');
        const closeGlobalSearch = document.getElementById('closeGlobalSearch');
        const globalSearchOverlay = globalSearchModal?.querySelector('.global-search-modal-overlay');
        
        if (globalSearchOverlay) {
            globalSearchOverlay.addEventListener('click', () => {
                this.closeGlobalSearch();
            });
        }
        
        if (globalSearchInput) {
            globalSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeGlobalSearch();
                }
            });
        }
        
        globalSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            const resultsContainer = document.getElementById('globalSearchResults');
            
            if (query) {
                const existingLoading = resultsContainer?.querySelector('.global-search-loading');
                if (!existingLoading && resultsContainer) {
                    const loadingDiv = document.createElement('div');
                    loadingDiv.className = 'global-search-loading';
                    loadingDiv.textContent = 'Searching...';
                    loadingDiv.style.position = 'absolute';
                    loadingDiv.style.top = '0.75rem';
                    loadingDiv.style.right = '1rem';
                    loadingDiv.style.pointerEvents = 'none';
                    loadingDiv.style.zIndex = '10';
                    resultsContainer.style.position = 'relative';
                    resultsContainer.appendChild(loadingDiv);
                }
                
                if (!window.searchEngine) {
                    console.error('Search engine not initialized. Check browser console for errors.');
                    if (resultsContainer) {
                        const loadingDiv = resultsContainer.querySelector('.global-search-loading');
                        if (loadingDiv) loadingDiv.remove();
                        resultsContainer.innerHTML = '<div class="empty-state-main"><p>Search engine not available. Check console for errors.</p></div>';
                    }
                    return;
                }
                
                window.searchEngine.performGlobalSearch(query);
            } else {
                if (resultsContainer) {
                    resultsContainer.innerHTML = '';
                    resultsContainer.style.position = '';
                }
                if (window.searchEngine && window.searchEngine.globalSearchTimeout) {
                    clearTimeout(window.searchEngine.globalSearchTimeout);
                    window.searchEngine.globalSearchTimeout = null;
                }
            }
        });

        closeGlobalSearch.addEventListener('click', () => {
            this.closeGlobalSearch();
        });

        const gFilterFunctions = document.getElementById('gFilterFunctions');
        const gIncludeFunctionParamsGroup = document.getElementById('gIncludeFunctionParamsGroup');
        
        const updateFunctionParamsVisibility = () => {
            if (gFilterFunctions && gIncludeFunctionParamsGroup) {
                if (gFilterFunctions.checked) {
                    gIncludeFunctionParamsGroup.style.display = 'flex';
                } else {
                    gIncludeFunctionParamsGroup.style.display = 'none';
                    document.getElementById('gIncludeFunctionParams').checked = false;
                }
            }
        };
        
        if (gFilterFunctions) {
            gFilterFunctions.addEventListener('change', () => {
                updateFunctionParamsVisibility();
                if (globalSearchInput.value.trim() && window.searchEngine) {
                    window.searchEngine.performGlobalSearch(globalSearchInput.value.trim());
                }
            });
        }
        
        updateFunctionParamsVisibility();
        
        ['gFilterClasses', 'gFilterStructs', 'gFilterEnums', 
         'gTypeSearchMode', 'gIncludeFunctionParams'].forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    if (globalSearchInput.value.trim() && window.searchEngine) {
                        window.searchEngine.performGlobalSearch(globalSearchInput.value.trim());
                    }
                });
            }
        });

        const copyCodeBtn = document.getElementById('copyCodeBtn');
        const copyCodeDetailBtn = document.getElementById('copyCodeDetailBtn');
        const exportCodeBtn = document.getElementById('exportCodeBtn');
        
        if (copyCodeBtn) {
            copyCodeBtn.addEventListener('click', (e) => this.copyGeneratedCode(e));
        }
        if (copyCodeDetailBtn) {
            copyCodeDetailBtn.addEventListener('click', (e) => this.copyGeneratedCode(e));
        }
        if (exportCodeBtn) {
            exportCodeBtn.addEventListener('click', () => this.exportGeneratedCode());
        }

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && !e.shiftKey && e.key === 'f') {
                e.preventDefault();
                sidebarSearchInput.focus();
            }
            
            if (e.ctrlKey && e.shiftKey && e.key === 'F') {
                e.preventDefault();
                this.openGlobalSearch();
            }
            
            if (e.key === 'Escape') {
                const globalSearchModal = document.getElementById('globalSearchModal');
                if (globalSearchModal && globalSearchModal.style.display !== 'none') {
                this.closeGlobalSearch();
                    return;
                }
                
                const advancedMemberSearchModal = document.getElementById('advancedMemberSearchModal');
                if (advancedMemberSearchModal && advancedMemberSearchModal.style.display !== 'none') {
                    this.closeAdvancedMemberSearch();
                    return;
                }
                
                const offsetsCollectionModal = document.getElementById('offsetsCollectionModal');
                if (offsetsCollectionModal && offsetsCollectionModal.style.display !== 'none') {
                    this.collections.closeOffsetsModal();
                    return;
                }
            }
        });
        
        document.addEventListener('auxclick', (e) => {
            if (e.button === 3 || e.button === 4) {
                const now = Date.now();
                if (now - this.lastNavigationTime < 200) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                if (e.button === 3) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.lastNavigationTime = now;
                    this.navigateBack();
                } else if (e.button === 4) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.lastNavigationTime = now;
                    this.navigateForward();
                }
            }
        });
        
        document.addEventListener('mousedown', (e) => {
            if (e.button === 3 || e.button === 4) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, { capture: true });
    }

    switchCategory(category, itemToSelect = null) {
        if (!this.isNavigatingHistory && this.currentDetailItem) {
            this.saveNavigationState();
        }
        
        this.currentCategory = category;
        
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        const titles = {
            classes: 'Classes',
            structs: 'Structs',
            functions: 'Functions',
            enums: 'Enums',
            offsets: 'Offsets'
        };
        document.getElementById('sidebarTitle').textContent = titles[category] || category;
        
        this.loadCategory(category, itemToSelect);
    }

    loadCategory(category, itemToSelect = null) {
        const index = this.indexes[category];
        if (!index) return;

        if (category === 'functions') {
            const classMap = new Map();
            index.forEach((item) => {
                const className = item.className || 'Unknown';
                if (!classMap.has(className)) {
                    classMap.set(className, {
                        name: className,
                        type: 'function-class',
                        functions: []
                    });
                }
                classMap.get(className).functions.push(item);
            });
            
            this.sidebarItems = Array.from(classMap.values()).sort((a, b) => {
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            });
        } else {
            this.sidebarItems = Array.from(index.values()).sort((a, b) => {
                const nameA = (a.name || a.funcName || a.className || '').toLowerCase();
                const nameB = (b.name || b.funcName || b.className || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
        }

        this.renderSidebar();
        
        if (itemToSelect) {
            setTimeout(() => {
                this.selectItemInSidebar(itemToSelect);
                this.showDetail(itemToSelect);
                if (this.navigationHistory.length === 0) {
                    setTimeout(() => {
                        this.saveNavigationState();
                        this.printNavigationHistory();
                    }, 150);
                }
            }, 10);
        } else if (this.sidebarItems && this.sidebarItems.length > 0) {
            const firstItem = this.sidebarItems[0];
            const firstSidebarElement = document.querySelector('.sidebar-item');
            if (firstSidebarElement) {
                document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
                firstSidebarElement.classList.add('active');
                this.showDetail(firstItem);
                if (this.navigationHistory.length === 0) {
                    setTimeout(() => {
                        this.saveNavigationState();
                        this.printNavigationHistory();
                    }, 150);
                }
            }
        }
    }

    filterSidebarItems(query) {
        const filtered = query 
            ? this.sidebarItems.filter(item => {
                const name = (item.name || item.funcName || item.className || '').toLowerCase();
                return name.includes(query);
            })
            : this.sidebarItems;
        
        this.renderSidebar(filtered);
    }

    renderSidebar(items = this.sidebarItems) {
        const sidebarList = document.getElementById('sidebarList');
        sidebarList.innerHTML = '';
        sidebarList.style.display = 'block';

        items.forEach(item => {
            const listItem = document.createElement('div');
            listItem.className = 'sidebar-item';
            const name = item.name || item.funcName || `${item.className}::${item.funcName}` || 'Unknown';
            listItem.textContent = name;
            listItem.addEventListener('click', () => {
                if (!this.isNavigatingHistory) {
                    this.saveNavigationState();
                }
                document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
                listItem.classList.add('active');
                this.showDetail(item);
            });
            sidebarList.appendChild(listItem);
        });
    }

    async showDetail(item, highlightQuery = null) {
        const currentItemNameStr = this.currentDetailItem?.name || this.currentDetailItem?.funcName || this.currentDetailItem?.className || '';
        const newItemNameStr = item?.name || item?.funcName || item?.className || '';
        const isDifferentItem = !this.currentDetailItem || currentItemNameStr !== newItemNameStr;
        
        this.currentDetailItem = item;
        this.highlightQuery = highlightQuery;
        
        if (!this.isNavigatingHistory && isDifferentItem && this.currentDetailItem) {
            setTimeout(() => {
                if (this.currentDetailItem === item) {
                    this.saveNavigationState();
                }
            }, 50);
        }
        const detailView = document.getElementById('detailView');
        const emptyState = document.getElementById('emptyState');
        
        detailView.style.display = 'flex';
        emptyState.style.display = 'none';

        setTimeout(() => {
            this.selectItemInSidebar(item);
        }, 50);

        if (item.type === 'function-class' && item.functions) {
            const title = item.name || 'Unknown';
            document.getElementById('detailTitleMain').textContent = title;
            document.getElementById('inheritancePath').innerHTML = '';
            
            const structTab = document.querySelector('[data-tab="struct"]');
            structTab.style.display = 'none';
            
            await this.switchDetailTab('overview');
            this.populateFunctionClassTab(item);
            return;
        }

        const title = item.name || item.funcName || `${item.className}::${item.funcName}` || 'Unknown';
        document.getElementById('detailTitleMain').textContent = title;

        const structTab = document.querySelector('[data-tab="struct"]');
        const itemType = item.type || item.searchType;
        
        if (itemType === 'class' || itemType === 'classes' || itemType === 'struct' || itemType === 'structs') {
            structTab.style.display = 'block';
        } else {
            structTab.style.display = 'none';
        }
        
        if (itemType === 'class' || itemType === 'classes' || itemType === 'struct' || itemType === 'structs') {
            window.inheritanceViewer.displayInheritancePath(item);
        } else {
            document.getElementById('inheritancePath').innerHTML = '';
        }

        await this.switchDetailTab('overview');
        await this.populateOverviewTab(item);
        this.setupTitleContextMenu(item);
    }
    
    setupTitleContextMenu(item) {
        const titleElement = document.getElementById('detailTitleMain');
        if (!titleElement) return;
        
        const itemType = item.type || item.searchType;
        if (itemType !== 'class' && itemType !== 'classes' && itemType !== 'struct' && itemType !== 'structs' && itemType !== 'enum') {
            titleElement.oncontextmenu = null;
            titleElement.style.cursor = '';
            return;
        }
        
        titleElement.oncontextmenu = (e) => {
            e.preventDefault();
            if (itemType === 'enum') {
                this.showEnumContextMenu(e, item);
            } else {
                this.collections.showClassContextMenu(e, item);
            }
        };
        
        titleElement.style.cursor = 'context-menu';
    }

    populateFunctionClassTab(item) {
        const overviewContent = document.getElementById('overviewContent');
        if (overviewContent && !overviewContent.querySelector('#functionBlocksContainer')) {
            overviewContent.innerHTML = `
                <table class="members-table" id="membersTable" style="display: none;">
                    <thead>
                        <tr>
                            <th>TYPE</th>
                            <th>MEMBER</th>
                            <th>OFFSET</th>
                            <th>SIZE</th>
                        </tr>
                    </thead>
                    <tbody id="membersTableBody">
                    </tbody>
                </table>
                <div id="functionBlocksContainer"></div>
            `;
        }
        
        const membersTable = document.getElementById('membersTable');
        const functionBlocksContainer = document.getElementById('functionBlocksContainer');
        if (membersTable) membersTable.style.display = 'none';
        if (functionBlocksContainer) {
            functionBlocksContainer.style.display = 'block';
            functionBlocksContainer.innerHTML = '';
        } else {
            console.error('functionBlocksContainer not found in populateFunctionClassTab!');
            return;
        }

        if (!item.functions || !Array.isArray(item.functions)) {
            if (functionBlocksContainer) {
                functionBlocksContainer.innerHTML = '<div class="empty-state">No functions available</div>';
            }
            return;
        }

        const sortedFunctions = [...item.functions].sort((a, b) => {
            const offsetA = (a.data && Array.isArray(a.data) && a.data.length >= 3) ? (a.data[2] || 0) : 0;
            const offsetB = (b.data && Array.isArray(b.data) && b.data.length >= 3) ? (b.data[2] || 0) : 0;
            return offsetA - offsetB;
        });

        sortedFunctions.forEach(funcItem => {
            if (funcItem.data && Array.isArray(funcItem.data) && funcItem.data.length >= 3) {
                const funcInfo = funcItem.data;
                const returnType = funcInfo[0];
                const params = funcInfo[1] || [];
                const offset = funcInfo[2] || 0;
                const flags = funcInfo[3] || '';

                let returnTypeStr = 'void';
                if (Array.isArray(returnType) && returnType.length > 0) {
                    returnTypeStr = window.inheritanceViewer.formatType(returnType);
                }

                const paramList = [];
                if (Array.isArray(params) && params.length > 0) {
                    params.forEach((param) => {
                        if (Array.isArray(param) && param.length >= 3) {
                            const paramType = param[0];
                            const paramName = param[2];
                            let paramTypeStr = 'Unknown';
                            if (Array.isArray(paramType) && paramType.length > 0) {
                                paramTypeStr = window.inheritanceViewer.formatType(paramType);
                            }
                            paramList.push({
                                type: paramTypeStr,
                                name: paramName || ''
                            });
                        }
                    });
                }

                const funcName = funcItem.funcName || 'Unknown';
                const flagsArray = flags ? flags.split('|').filter(f => f.trim()) : [];
                const flagsStr = flagsArray.length > 0 ? flagsArray.join('|') : '';
                
                const clickableReturnType = this.makeTypeClickable(returnTypeStr);
                const clickableParamStr = paramList.map(p => {
                    const clickableParamType = this.makeTypeClickable(p.type);
                    return p.name ? `${clickableParamType} ${escapeHtml(p.name)}` : clickableParamType;
                }).join(', ');
                const fullSignature = `${clickableReturnType} ${escapeHtml(funcName)}(${clickableParamStr})`;

                const funcBlock = document.createElement('div');
                funcBlock.className = 'function-block';
                funcBlock.innerHTML = `
                    <div class="function-header">
                        <div class="function-offset">0x${offset.toString(16)}</div>
                        ${flagsStr ? `<div class="function-flags">${escapeHtml(flagsStr)}</div>` : ''}
                        <button class="function-copy-btn" title="Copy function signature">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="function-signature-full">
                        <span class="function-signature-text">${fullSignature}</span>
                    </div>
                    ${paramList.length > 0 ? `
                    <div class="function-parameters">
                        ${paramList.map(p => {
                            const clickableParamType = this.makeTypeClickable(p.type);
                            return `
                            <div class="function-param">
                                <span class="param-type">${clickableParamType}</span>
                                ${p.name ? `<span class="param-comment">// <span class="param-name">${escapeHtml(p.name)}</span></span>` : ''}
                            </div>
                            `;
                        }).join('')}
                    </div>
                    ` : ''}
                `;
                
                this.setupTypeLinkHandlers(funcBlock);
                
                const copyBtn = funcBlock.querySelector('.function-copy-btn');
                if (copyBtn) {
                    copyBtn.addEventListener('click', async () => {
                        const plainSignature = `${returnTypeStr} ${funcName}(${paramList.map(p => p.name ? `${p.type} ${p.name}` : p.type).join(', ')})`;
                        if (plainSignature) {
                            await this.copyTextWithAnimation(copyBtn, plainSignature);
                        }
                    });
                }
                
                if (functionBlocksContainer) {
                    functionBlocksContainer.appendChild(funcBlock);
                }
            } else {
                console.warn('Function item has no data or invalid format:', funcItem);
            }
        });
        
        if (functionBlocksContainer && functionBlocksContainer.children.length === 0) {
            functionBlocksContainer.innerHTML = '<div class="empty-state">No functions found</div>';
        }
        
        const memberSearchContainer = document.getElementById('memberSearchContainer');
        if (memberSearchContainer) {
            memberSearchContainer.style.display = 'block';
            const advancedMemberSearchBtn = document.getElementById('advancedMemberSearchBtn');
            if (advancedMemberSearchBtn) {
                advancedMemberSearchBtn.style.display = 'none';
            }
        }
        
        this.setupMemberSearch();
    }

    async populateOverviewTab(item) {
        const tabOverview = document.getElementById('tabOverview');
        const overviewContent = document.getElementById('overviewContent');
        const tbody = document.getElementById('membersTableBody');
        const itemType = item.type || item.searchType;

        if (itemType === 'enum') {
            const enumCode = window.codeGenerator.generateEnumCodeForDisplay(item);
            const highlightedCode = window.codeGenerator.highlightCode(enumCode);
            
            const membersTable = document.getElementById('membersTable');
            const functionBlocksContainer = document.getElementById('functionBlocksContainer');
            if (membersTable) membersTable.style.display = 'none';
            if (functionBlocksContainer) functionBlocksContainer.style.display = 'none';
            
            const memberSearchContainer = document.getElementById('memberSearchContainer');
            if (memberSearchContainer) {
                memberSearchContainer.style.display = 'none';
            }
            
            if (overviewContent) {
                overviewContent.innerHTML = `
                    <div class="enum-code-display">
                        <pre class="code-block"><code>${highlightedCode}</code></pre>
                    </div>
                `;
            }
            return;
        }

        const membersTable = document.getElementById('membersTable');
        const functionBlocksContainer = document.getElementById('functionBlocksContainer');
        
        if (itemType === 'offset') {
            if (!membersTable && overviewContent) {
                overviewContent.innerHTML = `
                    <table class="members-table" id="membersTable">
                        <thead>
                            <tr>
                                <th>TYPE</th>
                                <th>MEMBER</th>
                                <th>OFFSET</th>
                            </tr>
                        </thead>
                        <tbody id="membersTableBody">
                        </tbody>
                    </table>
                    <div id="functionBlocksContainer" style="display: none;"></div>
                `;
            } else if (membersTable) {
                const thead = membersTable.querySelector('thead tr');
                if (thead) {
                    thead.innerHTML = `
                        <th>TYPE</th>
                        <th>MEMBER</th>
                        <th>OFFSET</th>
                    `;
                }
            }
            
            if (membersTable) membersTable.style.display = 'table';
            if (functionBlocksContainer) functionBlocksContainer.style.display = 'none';
            
            const currentTbody = document.getElementById('membersTableBody');
            if (!currentTbody) return;
            currentTbody.innerHTML = '';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="member-type">Offset</td>
                <td class="member-name">${escapeHtml(item.name)}</td>
                <td class="member-offset">0x${item.value.toString(16)}</td>
            `;
            currentTbody.appendChild(row);
            
            const memberSearchContainer = document.getElementById('memberSearchContainer');
            if (memberSearchContainer) {
                memberSearchContainer.style.display = 'none';
            }
            return;
        }
        
        if (!membersTable && overviewContent) {
            overviewContent.innerHTML = `
                <table class="members-table" id="membersTable">
                    <thead>
                        <tr>
                            <th>TYPE</th>
                            <th>MEMBER</th>
                            <th>OFFSET</th>
                            <th>SIZE</th>
                        </tr>
                    </thead>
                    <tbody id="membersTableBody">
                    </tbody>
                </table>
                <div id="functionBlocksContainer" style="display: none;"></div>
            `;
        }
        
        if (membersTable) membersTable.style.display = 'table';
        if (functionBlocksContainer) functionBlocksContainer.style.display = 'none';
        
        const currentTbody = document.getElementById('membersTableBody');
        if (!currentTbody) return;
        currentTbody.innerHTML = '';

        if (itemType === 'function') {
            if (overviewContent && !overviewContent.querySelector('#functionBlocksContainer')) {
                overviewContent.innerHTML = `
                    <table class="members-table" id="membersTable" style="display: none;">
                        <thead>
                            <tr>
                                <th>TYPE</th>
                                <th>MEMBER</th>
                                <th>OFFSET</th>
                                <th>SIZE</th>
                            </tr>
                        </thead>
                        <tbody id="membersTableBody">
                        </tbody>
                    </table>
                    <div id="functionBlocksContainer"></div>
                `;
            }
            
            const membersTable = document.getElementById('membersTable');
            const functionBlocksContainer = document.getElementById('functionBlocksContainer');
            if (membersTable) membersTable.style.display = 'none';
            if (functionBlocksContainer) {
                functionBlocksContainer.style.display = 'block';
                functionBlocksContainer.innerHTML = '';
            } else {
                console.error('functionBlocksContainer not found!');
                return;
            }
            
            if (item.data && Array.isArray(item.data) && item.data.length >= 3) {
                const funcInfo = item.data;
                const returnType = funcInfo[0];
                const params = funcInfo[1] || [];
                const offset = funcInfo[2] || 0;
                const flags = funcInfo[3] || '';

                let returnTypeStr = 'void';
                if (Array.isArray(returnType) && returnType.length > 0) {
                    returnTypeStr = window.inheritanceViewer.formatType(returnType);
                }

                const paramList = [];
                if (Array.isArray(params) && params.length > 0) {
                    params.forEach((param) => {
                        if (Array.isArray(param) && param.length >= 3) {
                            const paramType = param[0];
                            const paramName = param[2];
                            let paramTypeStr = 'Unknown';
                            if (Array.isArray(paramType) && paramType.length > 0) {
                                paramTypeStr = window.inheritanceViewer.formatType(paramType);
                            }
                            paramList.push({
                                type: paramTypeStr,
                                name: paramName || ''
                            });
                        }
                    });
                }

                const funcName = item.funcName || 'Unknown';
                
                const flagsArray = flags ? flags.split('|').filter(f => f.trim()) : [];
                const flagsStr = flagsArray.length > 0 ? flagsArray.join('|') : '';
                
                const paramStr = paramList.map(p => {
                    if (p.name) {
                        return `${p.type} ${p.name}`;
                    }
                    return p.type;
                }).join(', ');

                const clickableReturnType = this.makeTypeClickable(returnTypeStr);
                const clickableParamStr = paramList.map(p => {
                    const clickableParamType = this.makeTypeClickable(p.type);
                    return p.name ? `${clickableParamType} ${escapeHtml(p.name)}` : clickableParamType;
                }).join(', ');
                const fullSignature = `${clickableReturnType} ${escapeHtml(funcName)}(${clickableParamStr})`;

                const funcBlock = document.createElement('div');
                funcBlock.className = 'function-block';
                funcBlock.innerHTML = `
                    <div class="function-header">
                        <div class="function-offset">0x${offset.toString(16)}</div>
                        ${flagsStr ? `<div class="function-flags">${escapeHtml(flagsStr)}</div>` : ''}
                        <button class="function-copy-btn" title="Copy function signature">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="function-signature-full">
                        <span class="function-signature-text">${fullSignature}</span>
                    </div>
                    ${paramList.length > 0 ? `
                    <div class="function-parameters">
                        ${paramList.map(p => {
                            const clickableParamType = this.makeTypeClickable(p.type);
                            return `
                            <div class="function-param">
                                <span class="param-type">${clickableParamType}</span>
                                ${p.name ? `<span class="param-comment">// <span class="param-name">${escapeHtml(p.name)}</span></span>` : ''}
                            </div>
                            `;
                        }).join('')}
                    </div>
                    ` : ''}
                `;
                
                this.setupTypeLinkHandlers(funcBlock);
                
                const copyBtn = funcBlock.querySelector('.function-copy-btn');
                if (copyBtn) {
                    copyBtn.addEventListener('click', async () => {
                        if (fullSignature) {
                            await this.copyTextWithAnimation(copyBtn, fullSignature);
                        }
                    });
                }
                
                if (functionBlocksContainer) {
                    functionBlocksContainer.appendChild(funcBlock);
                }
            } else {
                if (functionBlocksContainer) {
                    functionBlocksContainer.innerHTML = '<div class="empty-state">No function data available</div>';
                }
            }
            
            const memberSearchContainer = document.getElementById('memberSearchContainer');
            if (memberSearchContainer) {
                memberSearchContainer.style.display = 'none';
            }
            return;
        }

        if (itemType === 'class' || itemType === 'classes' || itemType === 'struct' || itemType === 'structs') {
            if (!item.data || !Array.isArray(item.data)) {
                return;
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
                                typeStr = window.inheritanceViewer.formatType(typeInfo);
                            }

                            members.push({
                                name: memberName,
                                type: typeStr,
                                offset: offset,
                                size: size
                            });
                        }
                    }
                }
            }

            members.sort((a, b) => a.offset - b.offset);

            const memberSearchContainer = document.getElementById('memberSearchContainer');
            if (memberSearchContainer) {
                memberSearchContainer.style.display = 'block';
                const advancedMemberSearchBtn = document.getElementById('advancedMemberSearchBtn');
                if (advancedMemberSearchBtn) {
                    advancedMemberSearchBtn.style.display = 'flex';
                }
            }

            this.currentMembers = members;

            await this.renderMembersTable(members);
            this.setupMemberSearch();
            
            if (this.highlightQuery) {
                setTimeout(() => {
                    this.highlightMatchingMembers();
                }, 300);
            }
        } else {
            const memberSearchContainer = document.getElementById('memberSearchContainer');
            if (memberSearchContainer) {
                memberSearchContainer.style.display = 'none';
            }
        }
    }

    async switchDetailTab(tabName) {
        if (!this.isNavigatingHistory && this.currentDetailItem) {
            const currentTab = document.querySelector('.detail-tab.active')?.getAttribute('data-tab');
            if (currentTab && currentTab !== tabName) {
                this.saveNavigationState();
            }
        }
        document.querySelectorAll('.detail-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (tabButton) {
            tabButton.classList.add('active');
        }

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        const tabContent = document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
        if (tabContent) {
            tabContent.classList.add('active');
        }

        if (tabName === 'struct' && this.currentDetailItem) {
            const itemType = this.currentDetailItem.type || this.currentDetailItem.searchType;
            if (itemType === 'class' || itemType === 'classes' || itemType === 'struct' || itemType === 'structs') {
                window.codeGenerator.generateCode(this.currentDetailItem);
            } else if (itemType === 'enum') {
                window.codeGenerator.generateEnumCode(this.currentDetailItem);
            }
        } else if (tabName === 'overview' && this.currentDetailItem) {
            const isFunctionClass = (this.currentDetailItem.type === 'function-class' || 
                                    (this.currentDetailItem.functions && Array.isArray(this.currentDetailItem.functions))) &&
                                   this.currentCategory === 'functions';
            
            if (isFunctionClass) {
                this.populateFunctionClassTab(this.currentDetailItem);
            } else {
            const overviewContent = document.getElementById('overviewContent');
            const itemType = this.currentDetailItem.type || this.currentDetailItem.searchType;
            
            if (itemType !== 'enum' && overviewContent && !overviewContent.querySelector('#membersTable')) {
                overviewContent.innerHTML = `
                    <table class="members-table" id="membersTable">
                        <thead>
                            <tr>
                                <th>TYPE</th>
                                <th>MEMBER</th>
                                <th>OFFSET</th>
                                <th>SIZE</th>
                            </tr>
                        </thead>
                        <tbody id="membersTableBody">
                        </tbody>
                    </table>
                    <div id="functionBlocksContainer" style="display: none;"></div>
                `;
            }
            
                await this.populateOverviewTab(this.currentDetailItem);
            }
        }
    }

    openGlobalSearch() {
        document.getElementById('globalSearchModal').style.display = 'flex';
        document.getElementById('globalSearchInput').focus();
    }

    closeGlobalSearch() {
        document.getElementById('globalSearchModal').style.display = 'none';
        document.getElementById('globalSearchInput').value = '';
    }

    updateTimestamp() {
        const timestamp = document.getElementById('navTimestamp');
        if (timestamp) {
            let timestampText = '';
            
            if (this.data.offsets && this.data.offsets.timestamp) {
                timestampText = this.data.offsets.timestamp;
            } else if (this.data.offsets && this.data.offsets.metadata && this.data.offsets.metadata.timestamp) {
                timestampText = this.data.offsets.metadata.timestamp;
            } else if (this.data.offsets && this.data.offsets.date) {
                timestampText = this.data.offsets.date;
            } else if (this.data.offsets && this.data.offsets.time) {
                timestampText = this.data.offsets.time;
            } else {
                const now = new Date();
                timestampText = now.toLocaleString();
            }
            
            timestamp.textContent = timestampText;
        }
    }

    showNavigation() {
        const topNav = document.getElementById('topNav');
        if (topNav) {
            topNav.style.display = 'flex';
        }
        this.collections.updateOffsetsBadge();
    }

    hideNavigation() {
        const topNav = document.getElementById('topNav');
        if (topNav) {
            topNav.style.display = 'none';
        }
    }

    hideLoading() {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('mainLayout').style.display = 'flex';
    }

    makeTypeClickable(typeStr) {
        if (!typeStr || typeof typeStr !== 'string') return typeStr;
        
        const typePattern = /\b([UFAET][A-Za-z0-9_]+)\b/g;
        const parts = [];
        let lastIndex = 0;
        let match;
        
        while ((match = typePattern.exec(typeStr)) !== null) {
            const typeName = match[1];
            const beforeMatch = typeStr.substring(lastIndex, match.index);
            
            const exists = this.indexes.classes.has(typeName) || 
                         this.indexes.structs.has(typeName) || 
                         this.indexes.enums.has(typeName);
            
            if (exists) {
                if (beforeMatch) {
                    parts.push(escapeHtml(beforeMatch));
                }
                parts.push(`<span class="type-link" data-type="${escapeHtml(typeName)}" title="Click to navigate to ${typeName}">${escapeHtml(typeName)}</span>`);
            } else {
                if (beforeMatch) {
                    parts.push(escapeHtml(beforeMatch));
                }
                parts.push(escapeHtml(typeName));
            }
            
            lastIndex = match.index + match[0].length;
        }
        
        if (lastIndex < typeStr.length) {
            parts.push(escapeHtml(typeStr.substring(lastIndex)));
        }
        
        if (parts.length === 0) {
            return escapeHtml(typeStr);
        }
        
        return parts.join('');
    }

    setupTypeLinkHandlers(container) {
        if (!container) return;
        
        const self = this;
        
        if (!container._typeLinkHandler) {
            container._typeLinkHandler = function(e) {
                const link = e.target.closest('.type-link');
                if (link) {
                    e.preventDefault();
                    e.stopPropagation();
                    const typeName = link.getAttribute('data-type');
                    if (typeName) {
                        self.navigateToType(typeName);
                    }
                }
            };
            container.addEventListener('click', container._typeLinkHandler);
        }
        
        container.querySelectorAll('.type-link').forEach(link => {
            if (!link._hasTypeLinkHandler) {
                link._hasTypeLinkHandler = true;
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const typeName = this.getAttribute('data-type');
                    if (typeName) {
                        self.navigateToType(typeName);
                    }
                });
            }
        });
    }

    navigateToType(typeName) {
        if (!typeName) return;
        
        let item = this.indexes.classes.get(typeName);
        let targetCategory = 'classes';
        
        if (!item) {
            item = this.indexes.structs.get(typeName);
            targetCategory = 'structs';
        }
        
        if (!item) {
            item = this.indexes.enums.get(typeName);
            targetCategory = 'enums';
        }
        
        if (!item) {
            console.warn('Type not found:', typeName);
            return;
        }
        
        if (this.currentDetailItem && this.currentDetailItem === item) {
            return;
        }
        
        const currentName = this.currentDetailItem?.name || this.currentDetailItem?.className || this.currentDetailItem?.funcName;
        const itemName = item.name || item.className || item.funcName;
        if (currentName === itemName && this.currentCategory === targetCategory) {
            return;
        }
        
        if (this.currentCategory !== targetCategory) {
            this.switchCategory(targetCategory, item);
        } else {
            this.selectItemInSidebar(item);
            this.showDetail(item);
        }
    }

    selectItemInSidebar(item) {
        if (!item) return;
        
        const sidebarItems = document.querySelectorAll('.sidebar-item');
        const itemName = item.name || item.funcName || item.className || '';
        if (!itemName) return;
        
        let found = false;
        
        sidebarItems.forEach(sidebarItem => {
            const sidebarText = sidebarItem.textContent.trim();
            if (sidebarText === itemName) {
                sidebarItems.forEach(i => i.classList.remove('active'));
                sidebarItem.classList.add('active');
                sidebarItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                found = true;
            }
        });
        
        if (!found) {
            setTimeout(() => {
                const retryItems = document.querySelectorAll('.sidebar-item');
                retryItems.forEach(sidebarItem => {
                    const sidebarText = sidebarItem.textContent.trim();
                    if (sidebarText === itemName) {
                        retryItems.forEach(i => i.classList.remove('active'));
                        sidebarItem.classList.add('active');
                        sidebarItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                });
            }, 100);
        }
    }

    async copyGeneratedCode(event) {
        const btn = event?.target?.closest('button') || 
                   document.getElementById('copyCodeDetailBtn') || 
                   document.getElementById('copyCodeBtn');
        
        if (btn) {
            this.showCopyButtonLoading(btn);
        }
        
        if (this.currentDetailItem) {
            const itemType = this.currentDetailItem.type || this.currentDetailItem.searchType;
            
            if (itemType === 'class' || itemType === 'classes' || itemType === 'struct' || itemType === 'structs') {
                window.codeGenerator.generateCode(this.currentDetailItem);
            } else if (itemType === 'enum') {
                window.codeGenerator.generateEnumCode(this.currentDetailItem);
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const codeElement = document.getElementById('generatedCode');
        
        if (!codeElement) {
            console.error('Code element not found');
            if (btn) {
                this.showCopyButtonError(btn);
            } else {
                this.showToast('Failed to copy: Code element not found', 'error');
            }
            return;
        }

        const codeInner = codeElement.querySelector('code');
        const textToCopy = codeInner ? codeInner.textContent : codeElement.textContent;
        
        if (!textToCopy || textToCopy.trim().length === 0) {
            console.error('No code content to copy');
            if (btn) {
                this.showCopyButtonError(btn);
            } else {
                this.showToast('Failed to copy: No code content available', 'error');
            }
            return;
        }

        try {
            if (window.electronAPI && window.electronAPI.copyToClipboard) {
                try {
                    const result = await window.electronAPI.copyToClipboard(textToCopy);
                    if (!result || !result.success) {
                        await navigator.clipboard.writeText(textToCopy);
                    }
                } catch (electronError) {
                    console.warn('Electron clipboard API failed, trying web API:', electronError);
                    await navigator.clipboard.writeText(textToCopy);
                }
            } else {
                await navigator.clipboard.writeText(textToCopy);
            }
            
            if (btn) {
                this.showCopyButtonSuccess(btn);
            }
        } catch (error) {
            console.error('Failed to copy:', error);
            if (btn) {
                this.showCopyButtonError(btn);
            } else {
                this.showToast(`Failed to copy to clipboard: ${error.message || 'Unknown error'}`, 'error');
            }
        }
    }
    
    showCopyButtonLoading(btn) {
        if (!btn.dataset.originalContent) {
            btn.dataset.originalContent = btn.innerHTML;
        }
        
        btn.classList.add('copy-loading');
        btn.innerHTML = `
            <svg class="copy-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke-width="2" stroke-dasharray="31.416" stroke-dashoffset="31.416">
                    <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416;0 31.416" repeatCount="indefinite"/>
                    <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416;-31.416" repeatCount="indefinite"/>
                </circle>
            </svg>
        `;
        btn.disabled = true;
    }
    
    showCopyButtonSuccess(btn) {
        btn.classList.remove('copy-loading');
        btn.classList.add('copy-success');
        btn.innerHTML = `
            <svg class="copy-checkmark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5" stroke-dasharray="20" stroke-dashoffset="20">
                    <animate attributeName="stroke-dashoffset" dur="0.3s" values="20;0" fill="freeze"/>
                </path>
            </svg>
        `;
        btn.disabled = false;
        
                setTimeout(() => {
            btn.classList.remove('copy-success');
            btn.innerHTML = btn.dataset.originalContent || btn.innerHTML;
                }, 2000);
            }
    
    showCopyButtonError(btn) {
        btn.classList.remove('copy-loading');
        btn.classList.add('copy-error');
        btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
            </svg>
        `;
        btn.disabled = false;
        
        setTimeout(() => {
            btn.classList.remove('copy-error');
            btn.innerHTML = btn.dataset.originalContent || btn.innerHTML;
        }, 2000);
    }
    
    async copyTextWithAnimation(btn, text) {
        if (!btn.dataset.originalContent) {
            btn.dataset.originalContent = btn.innerHTML;
        }
        
        btn.classList.add('copy-loading');
        btn.innerHTML = `
            <svg class="copy-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke-width="2" stroke-dasharray="31.416" stroke-dashoffset="31.416">
                    <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416;0 31.416" repeatCount="indefinite"/>
                    <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416;-31.416" repeatCount="indefinite"/>
                </circle>
            </svg>
        `;
        
        try {
            await navigator.clipboard.writeText(text);
            btn.classList.remove('copy-loading');
            btn.classList.add('copy-success');
            btn.innerHTML = `
                <svg class="copy-checkmark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 6L9 17l-5-5" stroke-dasharray="20" stroke-dashoffset="20">
                        <animate attributeName="stroke-dashoffset" dur="0.3s" values="20;0" fill="freeze"/>
                    </path>
                </svg>
            `;
            
            setTimeout(() => {
                btn.classList.remove('copy-success');
                btn.innerHTML = btn.dataset.originalContent || btn.innerHTML;
            }, 2000);
        } catch (error) {
            btn.classList.remove('copy-loading');
            btn.classList.add('copy-error');
            btn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8v4M12 16h.01"/>
                </svg>
            `;
            
            setTimeout(() => {
                btn.classList.remove('copy-error');
                btn.innerHTML = btn.dataset.originalContent || btn.innerHTML;
            }, 2000);
        }
    }
    
    async copyOffsetWithAnimation(btn, text) {
        if (!btn.dataset.originalContent) {
            btn.dataset.originalContent = btn.innerHTML;
        }
        
        btn.classList.add('copy-loading');
        btn.innerHTML = `
            <svg class="copy-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke-width="2" stroke-dasharray="31.416" stroke-dashoffset="31.416">
                    <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416;0 31.416" repeatCount="indefinite"/>
                    <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416;-31.416" repeatCount="indefinite"/>
                </circle>
            </svg>
        `;
        
        try {
            await navigator.clipboard.writeText(text);
            btn.classList.remove('copy-loading');
            btn.classList.add('copy-success');
            btn.innerHTML = `
                <svg class="copy-checkmark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 6L9 17l-5-5" stroke-dasharray="20" stroke-dashoffset="20">
                        <animate attributeName="stroke-dashoffset" dur="0.3s" values="20;0" fill="freeze"/>
                    </path>
                </svg>
            `;
            
            setTimeout(() => {
                btn.classList.remove('copy-success');
                btn.innerHTML = btn.dataset.originalContent || btn.innerHTML;
            }, 2000);
        } catch (error) {
            btn.classList.remove('copy-loading');
            btn.classList.add('copy-error');
            btn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8v4M12 16h.01"/>
                </svg>
            `;
            
            setTimeout(() => {
                btn.classList.remove('copy-error');
                btn.innerHTML = btn.dataset.originalContent || btn.innerHTML;
            }, 2000);
        }
    }

    async exportGeneratedCode() {
        if (this.currentDetailItem) {
            const itemType = this.currentDetailItem.type || this.currentDetailItem.searchType;
            
            if (itemType === 'class' || itemType === 'classes' || itemType === 'struct' || itemType === 'structs') {
                window.codeGenerator.generateCode(this.currentDetailItem);
            } else if (itemType === 'enum') {
                window.codeGenerator.generateEnumCode(this.currentDetailItem);
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const codeElement = document.getElementById('generatedCode');
        if (!codeElement) {
            this.showToast('Code element not found', 'error');
            return;
        }
        
        const codeInner = codeElement.querySelector('code');
        const textToExport = codeInner ? codeInner.textContent : codeElement.textContent;
        
        if (!textToExport || textToExport.trim().length === 0) {
            this.showToast('No code content to export', 'error');
            return;
        }
        
            const item = this.currentDetailItem;
            const filename = (item?.name || item?.funcName || 'code') + '.h';
            try {
            const result = await window.electronAPI.saveFile(textToExport, filename);
                if (result.success) {
                this.showToast(`Code exported to ${result.path}`, 'success');
            } else {
                this.showToast('Failed to export file', 'error');
                }
            } catch (error) {
                console.error('Failed to export:', error);
            this.showToast('Failed to export file', 'error');
        }
    }
    
    highlightMatchingMembers() {
        if (!this.highlightQuery) return;
        
        const matchingRows = document.querySelectorAll('tr[data-highlight-match="true"]');
        if (matchingRows.length === 0) return;
        
        matchingRows.forEach((row, index) => {
            row.classList.add('search-highlight');
            
            if (index === 0) {
                setTimeout(() => {
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        });
        
        setTimeout(() => {
            matchingRows.forEach(row => {
                row.classList.remove('search-highlight');
                row.removeAttribute('data-highlight-match');
            });
            this.highlightQuery = null;
        }, 3000);
    }

    async renderMembersTable(members) {
        const currentTbody = document.getElementById('membersTableBody');
        if (!currentTbody) return;
        
        currentTbody.innerHTML = '';
        
        const currentClassName = this.currentDetailItem ? (this.currentDetailItem.name || this.currentDetailItem.data?.name) : null;
        
        const memberInCollectionSet = new Set();
        if (window.collectionStorage && currentClassName) {
            try {
                const collections = await window.collectionStorage.loadCollections();
                collections.forEach(collection => {
                    if (collection.members && Array.isArray(collection.members)) {
                        collection.members.forEach(m => {
                            if (m.className === currentClassName && m.memberName) {
                                memberInCollectionSet.add(`${m.className}::${m.memberName}`);
                            }
                        });
                    }
                });
            } catch (error) {
                console.warn('Failed to load collections for member check:', error);
            }
        }
        
        for (const member of members) {
            const row = document.createElement('tr');
            const offsetHex = '0x' + member.offset.toString(16);
            const memberKey = `${currentClassName}::${member.name}`;
            
            const inCollection = memberInCollectionSet.has(memberKey);
            
            const matchesQuery = this.highlightQuery && (
                member.name.toLowerCase().includes(this.highlightQuery) ||
                member.type.toLowerCase().includes(this.highlightQuery)
            );
            
            if (matchesQuery) {
                row.setAttribute('data-highlight-match', 'true');
            }
            
            row.setAttribute('data-member-name', member.name.toLowerCase());
            row.setAttribute('data-member-type', member.type.toLowerCase());
            row.setAttribute('data-member-offset', offsetHex.toLowerCase());
            row.setAttribute('data-member-key', memberKey);
            row.setAttribute('data-class-name', currentClassName || '');
            
            const clickableType = this.makeTypeClickable(member.type);
            const collectionBadge = inCollection ? '<span class="member-in-collection-badge" title="Member is in a collection">✓</span>' : '';
            
            row.innerHTML = `
                <td class="member-type">${clickableType}</td>
                <td class="member-name">${escapeHtml(member.name)} ${collectionBadge}</td>
                <td class="member-offset">${offsetHex}</td>
                <td class="member-size">${member.size}</td>
            `;
            
            row.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.collections.showMemberContextMenu(e, row, currentClassName, member);
        });
        
            currentTbody.appendChild(row);
        }
        
        this.setupTypeLinkHandlers(currentTbody);
        
        document.addEventListener('click', () => {
            this.collections.hideMemberContextMenu();
            this.collections.hideClassContextMenu();
            this.collections.hideEnumContextMenu();
        });
    }
    
    async refreshMemberCheckmarks() {
        const currentTbody = document.getElementById('membersTableBody');
        if (!currentTbody) return;
        
        const currentClassName = this.currentDetailItem ? (this.currentDetailItem.name || this.currentDetailItem.data?.name) : null;
        if (!currentClassName) return;
        
        const memberInCollectionSet = new Set();
        if (window.collectionStorage) {
            try {
                const collections = await window.collectionStorage.loadCollections();
                collections.forEach(collection => {
                    if (collection.members && Array.isArray(collection.members)) {
                        collection.members.forEach(m => {
                            if (m.className === currentClassName && m.memberName) {
                                memberInCollectionSet.add(`${m.className}::${m.memberName.toLowerCase()}`);
                            }
                        });
                    }
                });
            } catch (error) {
                console.warn('Failed to load collections for member check:', error);
            }
        }
        
        const rows = currentTbody.querySelectorAll('tr');
        rows.forEach(row => {
            const memberNameAttr = row.getAttribute('data-member-name');
            if (!memberNameAttr) return;
            
            const memberKey = `${currentClassName}::${memberNameAttr}`;
            const inCollection = memberInCollectionSet.has(memberKey);
            
            const memberNameCell = row.querySelector('.member-name');
            if (memberNameCell) {
                const existingBadge = memberNameCell.querySelector('.member-in-collection-badge');
                
                if (inCollection && !existingBadge) {
                    const currentText = memberNameCell.textContent || '';
                    const memberNameDisplay = currentText.replace('✓', '').trim();
                    if (memberNameDisplay) {
                        memberNameCell.innerHTML = `${escapeHtml(memberNameDisplay)} <span class="member-in-collection-badge" title="Member is in a collection">✓</span>`;
                    }
                } else if (!inCollection && existingBadge) {
                    const currentText = memberNameCell.textContent || '';
                    const memberNameDisplay = currentText.replace('✓', '').trim();
                    if (memberNameDisplay) {
                        memberNameCell.innerHTML = escapeHtml(memberNameDisplay);
                    }
                }
            }
        });
    }
    
    saveNavigationState() {
        return this.navigation.saveNavigationState();
    }

    getCurrentNavigationState() {
        return this.navigation.getCurrentNavigationState();
    }

    compareNavigationStates(state1, state2) {
        return this.navigation.compareNavigationStates(state1, state2);
    }

    navigateBack() {
        return this.navigation.navigateBack();
    }

    navigateForward() {
        return this.navigation.navigateForward();
    }

    printNavigationHistory() {
        if (this.navigation && this.navigation.printNavigationHistory) {
            return this.navigation.printNavigationHistory();
        }
        return;
    }

    restoreNavigationState(state) {
        return this.navigation.restoreNavigationState(state);
    }

    setupMemberSearch() {
        const memberSearchInput = document.getElementById('memberSearchInput');
        const clearMemberSearchBtn = document.getElementById('clearMemberSearchBtn');
        const memberSearchResults = document.getElementById('memberSearchResults');
        const advancedMemberSearchBtn = document.getElementById('advancedMemberSearchBtn');
        
        if (!memberSearchInput) return;

        this.memberSearchQuery = '';
        this.memberSearchMatches = [];
        this.memberSearchCurrentIndex = -1;

        memberSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            this.memberSearchQuery = query;
            
            if (query.length === 0) {
                this.clearMemberSearch();
                return;
            }

            this.performMemberSearch(query);
        });

        if (clearMemberSearchBtn) {
            clearMemberSearchBtn.addEventListener('click', () => {
                this.clearMemberSearch();
            });
        }

        if (advancedMemberSearchBtn) {
            advancedMemberSearchBtn.addEventListener('click', () => {
                this.openAdvancedMemberSearch();
            });
        }

        memberSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateMemberSearch(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateMemberSearch(-1);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.clearMemberSearch();
            }
        });

        this.setupAdvancedMemberSearch();
    }

    setupAdvancedMemberSearch() {
        const modal = document.getElementById('advancedMemberSearchModal');
        const closeBtn = document.getElementById('closeAdvancedMemberSearch');
        const searchInput = document.getElementById('advancedMemberSearchInput');
        const overlay = modal?.querySelector('.advanced-member-search-modal-overlay');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeAdvancedMemberSearch();
            });
        }

        if (overlay) {
            overlay.addEventListener('click', () => {
                this.closeAdvancedMemberSearch();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeAdvancedMemberSearch();
                }
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleAdvancedSearchInput();
            });
        }

        const directionRadios = document.querySelectorAll('input[name="searchDirection"]');
        directionRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.handleAdvancedSearchInput();
            });
        });

        const typeCheckboxes = [
            'advSearchMembers',
            'advSearchFunctions',
            'advSearchFunctionParams',
            'advSearchClasses',
            'advSearchStructs',
            'advSearchEnums'
        ];

        typeCheckboxes.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    this.handleAdvancedSearchInput();
                });
            }
        });
    }

    async handleAdvancedSearchInput() {
        const searchInput = document.getElementById('advancedMemberSearchInput');
        if (!searchInput) return;

        if (this.advancedSearchTimeout) {
            clearTimeout(this.advancedSearchTimeout);
        }

        const query = searchInput.value.trim();
        const resultsContainer = document.getElementById('advancedMemberSearchResults');
        
        if (query.length === 0) {
            this.advancedSearchQuery = '';
            if (resultsContainer) {
                resultsContainer.innerHTML = '';
            }
            return;
        }

        this.advancedSearchTimeout = setTimeout(async () => {
            this.advancedSearchQuery = query;

            const directionRadio = document.querySelector('input[name="searchDirection"]:checked');
            const direction = directionRadio ? directionRadio.value : 'up';

            const searchTypes = {
                members: document.getElementById('advSearchMembers')?.checked || false,
                functions: document.getElementById('advSearchFunctions')?.checked || false,
                functionParams: document.getElementById('advSearchFunctionParams')?.checked || false,
                classes: document.getElementById('advSearchClasses')?.checked || false,
                structs: document.getElementById('advSearchStructs')?.checked || false,
                enums: document.getElementById('advSearchEnums')?.checked || false
            };

            const hasTypeSelected = Object.values(searchTypes).some(v => v);
            if (!hasTypeSelected) {
                if (resultsContainer) {
                    resultsContainer.innerHTML = '<div class="advanced-search-empty-state">Please select at least one search type</div>';
                }
                return;
            }

            if (resultsContainer) {
                resultsContainer.innerHTML = '<div class="advanced-search-empty-state">Searching...</div>';
            }

            try {
                const results = await this.performAdvancedMemberSearch(query, direction, searchTypes);
                this.displayAdvancedSearchResults(results);
            } catch (error) {
                console.error('Advanced search error:', error);
                if (resultsContainer) {
                    resultsContainer.innerHTML = '<div class="advanced-search-empty-state">Error performing search</div>';
                }
            }
        }, 300);
    }

    performMemberSearch(query) {
        const currentTbody = document.getElementById('membersTableBody');
        const functionBlocksContainer = document.getElementById('functionBlocksContainer');
        const clearMemberSearchBtn = document.getElementById('clearMemberSearchBtn');
        const memberSearchResults = document.getElementById('memberSearchResults');
        
        this.memberSearchMatches = [];
        const lowerQuery = query.toLowerCase();

        if (currentTbody) {
        const rows = Array.from(currentTbody.querySelectorAll('tr'));
        
        rows.forEach(row => {
            const memberName = row.getAttribute('data-member-name') || '';
            const memberType = row.getAttribute('data-member-type') || '';
            const memberOffset = row.getAttribute('data-member-offset') || '';
            
                const matches = memberName.toLowerCase().includes(lowerQuery) || 
                               memberType.toLowerCase().includes(lowerQuery) || 
                               memberOffset.toLowerCase().includes(lowerQuery);
            
            if (matches) {
                row.style.display = '';
                row.classList.add('member-search-match');
                this.memberSearchMatches.push(row);
            } else {
                row.style.display = 'none';
                row.classList.remove('member-search-match', 'member-search-current');
            }
        });
        }
        
        if (functionBlocksContainer && functionBlocksContainer.style.display !== 'none') {
            const functionBlocks = Array.from(functionBlocksContainer.querySelectorAll('.function-block'));
            
            functionBlocks.forEach(block => {
                const signatureText = block.querySelector('.function-signature-text');
                const offsetText = block.querySelector('.function-offset');
                
                if (signatureText && offsetText) {
                    const signature = signatureText.textContent || '';
                    const offset = offsetText.textContent || '';
                    
                    const matches = signature.toLowerCase().includes(lowerQuery) || 
                                   offset.toLowerCase().includes(lowerQuery);
                    
                    if (matches) {
                        block.style.display = '';
                        block.classList.add('member-search-match');
                        this.memberSearchMatches.push(block);
                    } else {
                        block.style.display = 'none';
                        block.classList.remove('member-search-match', 'member-search-current');
                    }
                }
            });
        }

        if (clearMemberSearchBtn) {
            clearMemberSearchBtn.style.display = query ? 'block' : 'none';
        }

        if (memberSearchResults) {
            if (this.memberSearchMatches.length > 0) {
                memberSearchResults.textContent = `${this.memberSearchMatches.length} match${this.memberSearchMatches.length !== 1 ? 'es' : ''} found`;
            } else {
                memberSearchResults.textContent = 'No matches found';
            }
        }

        if (this.memberSearchMatches.length > 0) {
            this.memberSearchCurrentIndex = 0;
            this.highlightCurrentMatch();
        } else {
            this.memberSearchCurrentIndex = -1;
        }
    }

    navigateMemberSearch(direction) {
        if (this.memberSearchMatches.length === 0) return;

        if (this.memberSearchCurrentIndex >= 0 && this.memberSearchCurrentIndex < this.memberSearchMatches.length) {
            this.memberSearchMatches[this.memberSearchCurrentIndex].classList.remove('member-search-current');
        }

        this.memberSearchCurrentIndex += direction;
        if (this.memberSearchCurrentIndex < 0) {
            this.memberSearchCurrentIndex = this.memberSearchMatches.length - 1;
        } else if (this.memberSearchCurrentIndex >= this.memberSearchMatches.length) {
            this.memberSearchCurrentIndex = 0;
        }

        this.highlightCurrentMatch();
    }

    highlightCurrentMatch() {
        if (this.memberSearchCurrentIndex >= 0 && this.memberSearchCurrentIndex < this.memberSearchMatches.length) {
            const currentMatch = this.memberSearchMatches[this.memberSearchCurrentIndex];
            currentMatch.classList.add('member-search-current');
            
            if (currentMatch.tagName === 'TR') {
                currentMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (currentMatch.classList.contains('function-block')) {
                currentMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    clearMemberSearch() {
        const memberSearchInput = document.getElementById('memberSearchInput');
        const clearMemberSearchBtn = document.getElementById('clearMemberSearchBtn');
        const memberSearchResults = document.getElementById('memberSearchResults');
        const currentTbody = document.getElementById('membersTableBody');
        
        if (memberSearchInput) {
            memberSearchInput.value = '';
        }
        
        if (clearMemberSearchBtn) {
            clearMemberSearchBtn.style.display = 'none';
        }
        
        if (memberSearchResults) {
            memberSearchResults.textContent = '';
        }

        this.memberSearchQuery = '';
        this.memberSearchMatches = [];
        this.memberSearchCurrentIndex = -1;

        if (currentTbody) {
            const rows = currentTbody.querySelectorAll('tr');
            rows.forEach(row => {
                row.style.display = '';
                row.classList.remove('member-search-match', 'member-search-current');
            });
        }
        
        const functionBlocksContainer = document.getElementById('functionBlocksContainer');
        if (functionBlocksContainer) {
            const functionBlocks = functionBlocksContainer.querySelectorAll('.function-block');
            functionBlocks.forEach(block => {
                block.style.display = '';
                block.classList.remove('member-search-match', 'member-search-current');
            });
        }
    }

    getInheritanceChainUp(item) {
        return this.getFullInheritanceChainRecursive(item);
    }

    getInheritanceChainDown(item) {
        const className = item.name || item.className;
        if (!className || !window.inheritanceViewer) {
            return [];
        }
        
        const directChildren = window.inheritanceViewer.findChildren(className);
        
        const allChildren = new Set(directChildren);
        const visited = new Set();
        
        const traverse = (childName) => {
            if (visited.has(childName)) return;
            visited.add(childName);
            
            const childItem = this.indexes.classes.get(childName) || 
                            this.indexes.structs.get(childName);
            if (childItem) {
                const grandchildren = window.inheritanceViewer.findChildren(childName);
                grandchildren.forEach(grandchild => {
                    allChildren.add(grandchild);
                    traverse(grandchild);
                });
            }
        };
        
        directChildren.forEach(child => traverse(child));
        return Array.from(allChildren);
    }

    getInheritanceChainBoth(item) {
        const up = this.getInheritanceChainUp(item);
        const down = this.getInheritanceChainDown(item);
        const currentName = item.name || item.className;
        
        const all = new Set([currentName, ...up, ...down]);
        return Array.from(all);
    }

    searchInClassForMember(classItem, query, searchTypes) {
        const results = [];
        const lowerQuery = query.toLowerCase();
        const className = classItem.name || classItem.className;
        
        if (!classItem.data || !Array.isArray(classItem.data)) {
            return results;
        }

        if (searchTypes.members) {
            for (const member of classItem.data) {
                if (typeof member === 'object' && member !== null) {
                    const entries = Object.entries(member);
                    for (const [memberName, memberData] of entries) {
                        if (memberName === '__InheritInfo' || memberName === '__MDKClassSize') {
                            continue;
                        }
                        
                        const memberNameLower = memberName.toLowerCase();
                        let typeStr = 'Unknown';
                        
                        if (Array.isArray(memberData) && memberData.length >= 2) {
                            const typeInfo = memberData[0];
                            if (Array.isArray(typeInfo) && typeInfo.length > 0) {
                                typeStr = window.inheritanceViewer.formatType(typeInfo);
                            }
                        }
                        
                        const typeStrLower = typeStr.toLowerCase();
                        
                        if (memberNameLower.includes(lowerQuery) || typeStrLower.includes(lowerQuery)) {
                            results.push({
                                type: 'member',
                                className: className,
                                name: memberName,
                                typeStr: typeStr,
                                offset: Array.isArray(memberData) && memberData.length >= 2 ? memberData[1] : null,
                                size: Array.isArray(memberData) && memberData.length >= 3 ? memberData[2] : null
                            });
                        }
                    }
                }
            }
        }

        if (searchTypes.functions) {
            const functionIndex = this.indexes.functions;
            if (functionIndex) {
                functionIndex.forEach((funcItem) => {
                    if (funcItem.className === className) {
                        const funcName = funcItem.funcName || '';
                        if (funcName.toLowerCase().includes(lowerQuery)) {
                            results.push({
                                type: 'function',
                                className: className,
                                name: funcName,
                                funcItem: funcItem
                            });
                        }
                    }
                });
            }
        }

        if (searchTypes.functionParams) {
            const functionIndex = this.indexes.functions;
            if (functionIndex) {
                functionIndex.forEach((funcItem) => {
                    if (funcItem.className === className && funcItem.data && Array.isArray(funcItem.data)) {
                        const funcInfo = funcItem.data;
                        if (funcInfo.length > 1) {
                            const params = funcInfo[1];
                            if (Array.isArray(params)) {
                                for (const param of params) {
                                    if (Array.isArray(param) && param.length >= 3) {
                                        const paramType = param[0];
                                        const paramName = param[2] || '';
                                        
                                        let paramTypeStr = 'Unknown';
                                        if (Array.isArray(paramType) && paramType.length > 0) {
                                            paramTypeStr = window.inheritanceViewer.formatType(paramType);
                                        }
                                        
                                        if (paramName.toLowerCase().includes(lowerQuery) || 
                                            paramTypeStr.toLowerCase().includes(lowerQuery)) {
                                            results.push({
                                                type: 'param',
                                                className: className,
                                                functionName: funcItem.funcName || '',
                                                name: paramName,
                                                typeStr: paramTypeStr
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }

        if (searchTypes.classes || searchTypes.structs || searchTypes.enums) {
            const nameLower = className.toLowerCase();
            if (nameLower.includes(lowerQuery)) {
                const itemType = classItem.type || classItem.searchType;
                if ((itemType === 'class' || itemType === 'classes') && searchTypes.classes) {
                    results.push({
                        type: 'class',
                        className: className,
                        name: className
                    });
                } else if ((itemType === 'struct' || itemType === 'structs') && searchTypes.structs) {
                    results.push({
                        type: 'struct',
                        className: className,
                        name: className
                    });
                } else if (itemType === 'enum' && searchTypes.enums) {
                    results.push({
                        type: 'enum',
                        className: className,
                        name: className
                    });
                }
            }
        }

        return results;
    }

    async performAdvancedMemberSearch(query, direction, searchTypes) {
        if (!this.currentDetailItem) {
            return [];
        }

        const itemType = this.currentDetailItem.type || this.currentDetailItem.searchType;
        if (itemType !== 'class' && itemType !== 'classes' && itemType !== 'struct' && itemType !== 'structs') {
            return [];
        }

        if (!this.indexes || !this.indexes.classes || !this.indexes.structs || !this.preprocessedData) {
            return [];
        }

        const currentName = this.currentDetailItem.name || this.currentDetailItem.className;
        const lowerQuery = query.toLowerCase();
        const allResults = [];
        const maxResults = this.maxAdvancedSearchResults;
        
        const visited = new Set();
        
        const shouldContinue = () => allResults.length < maxResults;
        
        let classesToSearch = [];
        const currentChain = this.preprocessedData?.inheritanceChains?.get(currentName);
        
        if (currentChain && currentChain.parents && currentChain.children) {
            if (direction === 'up') {
                classesToSearch = [currentName, ...currentChain.parents];
            } else if (direction === 'down') {
                classesToSearch = [currentName, ...currentChain.children];
            } else if (direction === 'both') {
                classesToSearch = [currentName, ...currentChain.parents, ...currentChain.children];
            }
        } else {
            if (direction === 'up') {
                classesToSearch = this.getInheritanceChainUp(this.currentDetailItem);
            } else if (direction === 'down') {
                classesToSearch = this.getInheritanceChainDown(this.currentDetailItem);
            } else if (direction === 'both') {
                classesToSearch = this.getInheritanceChainBoth(this.currentDetailItem);
            }
            if (!classesToSearch.includes(currentName)) {
                classesToSearch.push(currentName);
            }
        }
        
        classesToSearch = [...new Set(classesToSearch)];
        
        const referencedTypesToSearch = new Map();

        const chunkSize = 50;
        for (let i = 0; i < classesToSearch.length && shouldContinue(); i += chunkSize) {
            const chunk = classesToSearch.slice(i, i + chunkSize);
            
            for (const className of chunk) {
                if (!shouldContinue()) break;
                if (visited.has(className)) continue;
                visited.add(className);
                
                const classItem = this.indexes.classes.get(className) || 
                                this.indexes.structs.get(className);
                if (!classItem) continue;
                
                const referencedTypes = new Map();
                
                if (searchTypes.members && classItem.data && Array.isArray(classItem.data)) {
                    for (const member of classItem.data) {
                        if (!shouldContinue()) break;
                        if (typeof member !== 'object' || member === null) continue;
                        
                        const entries = Object.entries(member);
                        for (const [memberName, memberData] of entries) {
                            if (!shouldContinue()) break;
                            if (memberName === '__InheritInfo' || memberName === '__MDKClassSize') {
                                continue;
                            }
                            
                            const memberNameLower = memberName.toLowerCase();
                            const nameMatches = memberNameLower.includes(lowerQuery);
                            
                            let typeStr = null;
                            let typeStrLower = '';
                            let needsTypeCheck = false;
                            
                            if (Array.isArray(memberData) && memberData.length >= 2) {
                                const typeInfo = memberData[0];
                                if (Array.isArray(typeInfo) && typeInfo.length > 0) {
                                    if (!nameMatches) {
                                        typeStr = window.inheritanceViewer.formatType(typeInfo);
                                        typeStrLower = typeStr.toLowerCase();
                                        needsTypeCheck = typeStrLower.includes(lowerQuery);
                                    }
                                    
                                    if (shouldContinue()) {
                                        const extractTypeName = (typeArr) => {
                                            if (!Array.isArray(typeArr) || typeArr.length === 0) return null;
                                            const first = typeArr[0];
                                            if (typeof first === 'string') return first;
                                            if (Array.isArray(first) && first.length > 0) {
                                                return typeof first[0] === 'string' ? first[0] : null;
                                            }
                                            return null;
                                        };
                                        
                                        const refTypeName = extractTypeName(typeInfo);
                                        if (refTypeName && refTypeName.length > 0 && 
                                            (refTypeName[0] === 'U' || refTypeName[0] === 'F' || refTypeName[0] === 'A' || refTypeName[0] === 'E') &&
                                            !refTypeName.startsWith('T') &&
                                            (this.indexes.classes.has(refTypeName) || this.indexes.structs.has(refTypeName))) {
                                            if (!referencedTypes.has(refTypeName)) {
                                                referencedTypes.set(refTypeName, []);
                                            }
                                            referencedTypes.get(refTypeName).push({memberName: memberName, fromClass: className});
                                        }
                                    }
                                }
                            }
                            
                            if (nameMatches || needsTypeCheck) {
                                if (typeStr === null && Array.isArray(memberData) && memberData.length >= 2) {
                                    const typeInfo = memberData[0];
                                    if (Array.isArray(typeInfo) && typeInfo.length > 0) {
                                        typeStr = window.inheritanceViewer.formatType(typeInfo);
                                    } else {
                                        typeStr = 'Unknown';
                                    }
                                } else if (typeStr === null) {
                                    typeStr = 'Unknown';
                                }
                                
                                allResults.push({
                                    type: 'member',
                                    className: className,
                                    name: memberName,
                                    typeStr: typeStr,
                                    offset: Array.isArray(memberData) && memberData.length >= 2 ? memberData[1] : null,
                                    size: Array.isArray(memberData) && memberData.length >= 3 ? memberData[2] : null
                                });
                            }
                        }
                    }
                }
                
                if (shouldContinue()) {
                    referencedTypes.forEach((refs, refTypeName) => {
                        if (!referencedTypesToSearch.has(refTypeName)) {
                            referencedTypesToSearch.set(refTypeName, []);
                        }
                        if (referencedTypesToSearch.get(refTypeName).length === 0) {
                            referencedTypesToSearch.get(refTypeName).push(refs[0]);
                        }
                    });
                }
                
                if (shouldContinue() && searchTypes.functions) {
                    const classFunctions = this.preprocessedData.functionsByClass.get(className);
                    if (classFunctions) {
                        for (const func of classFunctions) {
                            if (!shouldContinue()) break;
                            const funcName = func.funcName || '';
                            if (funcName.toLowerCase().includes(lowerQuery)) {
                                allResults.push({
                                    type: 'function',
                                    className: className,
                                    name: funcName,
                                    funcItem: func.funcItem
                                });
                            }
                        }
                    }
                }
                
                if (shouldContinue() && searchTypes.functionParams) {
                    const classParams = this.preprocessedData.paramsByClass.get(className);
                    if (classParams) {
                        for (const param of classParams) {
                            if (!shouldContinue()) break;
                            const paramNameLower = param.name.toLowerCase();
                            const paramTypeLower = param.typeStr.toLowerCase();
                            
                            if (paramNameLower.includes(lowerQuery) || paramTypeLower.includes(lowerQuery)) {
                                allResults.push({
                                    type: 'param',
                                    className: className,
                                    functionName: param.functionName,
                                    name: param.name,
                                    typeStr: param.typeStr
                                });
                            }
                        }
                    }
                }
                
                if (shouldContinue() && (searchTypes.classes || searchTypes.structs || searchTypes.enums)) {
                    if (className.toLowerCase().includes(lowerQuery)) {
                        const itemType = classItem.type || classItem.searchType;
                        if ((itemType === 'class' || itemType === 'classes') && searchTypes.classes) {
                            allResults.push({
                                type: 'class',
                                className: className,
                                name: className
                            });
                        } else if ((itemType === 'struct' || itemType === 'structs') && searchTypes.structs) {
                            allResults.push({
                                type: 'struct',
                                className: className,
                                name: className
                            });
                        } else if (itemType === 'enum' && searchTypes.enums) {
                            allResults.push({
                                type: 'enum',
                                className: className,
                                name: className
                            });
                        }
                    }
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        if (shouldContinue() && searchTypes.members && referencedTypesToSearch.size > 0) {
            for (const [refTypeName, refs] of referencedTypesToSearch.entries()) {
                if (!shouldContinue()) break;
                if (visited.has(refTypeName)) continue;
                visited.add(refTypeName);
                
                const refClassItem = this.indexes.classes.get(refTypeName) || 
                                    this.indexes.structs.get(refTypeName);
                if (!refClassItem || !refClassItem.data || !Array.isArray(refClassItem.data)) continue;
                
                const refInfo = refs[0];
                
                for (const member of refClassItem.data) {
                    if (!shouldContinue()) break;
                    if (typeof member !== 'object' || member === null) continue;
                    
                    const entries = Object.entries(member);
                    for (const [memberName, memberData] of entries) {
                        if (!shouldContinue()) break;
                        if (memberName === '__InheritInfo' || memberName === '__MDKClassSize') {
                            continue;
                        }
                        
                        const memberNameLower = memberName.toLowerCase();
                        const nameMatches = memberNameLower.includes(lowerQuery);
                        
                        let typeStr = null;
                        if (!nameMatches && Array.isArray(memberData) && memberData.length >= 2) {
                            const typeInfo = memberData[0];
                            if (Array.isArray(typeInfo) && typeInfo.length > 0) {
                                typeStr = window.inheritanceViewer.formatType(typeInfo);
                                if (!typeStr.toLowerCase().includes(lowerQuery)) {
                                    continue;
                                }
                            } else {
                                continue;
                            }
                        } else if (!nameMatches) {
                            continue;
                        } else {
                            if (Array.isArray(memberData) && memberData.length >= 2) {
                                const typeInfo = memberData[0];
                                if (Array.isArray(typeInfo) && typeInfo.length > 0) {
                                    typeStr = window.inheritanceViewer.formatType(typeInfo);
                                } else {
                                    typeStr = 'Unknown';
                                }
                            } else {
                                typeStr = 'Unknown';
                            }
                        }
                        
                        allResults.push({
                            type: 'member',
                            className: refTypeName,
                            name: memberName,
                            typeStr: typeStr,
                            offset: Array.isArray(memberData) && memberData.length >= 2 ? memberData[1] : null,
                            size: Array.isArray(memberData) && memberData.length >= 3 ? memberData[2] : null,
                            referencedFrom: refInfo.fromClass,
                            referencedVia: refInfo.memberName
                        });
                    }
                }
            }
        }
        
        if (allResults.length > maxResults) {
            allResults.splice(maxResults);
        }

        return allResults;
    }

    displayAdvancedSearchResults(results) {
        const resultsContainer = document.getElementById('advancedMemberSearchResults');
        if (!resultsContainer) return;

        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="advanced-search-empty-state">No matches found</div>';
            return;
        }

        const currentName = this.currentDetailItem?.name || this.currentDetailItem?.className || '';
        
        const groupedResults = new Map();
        results.forEach(result => {
            const className = result.className;
            if (!groupedResults.has(className)) {
                groupedResults.set(className, []);
            }
            groupedResults.get(className).push(result);
        });

        let html = '';
        groupedResults.forEach((matches, className) => {
            const inheritancePath = this.getInheritancePathToClass(currentName, className);
            const isCurrentClass = className === currentName;
            const hasReference = matches.some(m => m.referencedFrom && m.referencedVia);
            
            html += `<div class="advanced-search-result-group">`;
            html += `<div class="advanced-search-group-header">`;
            
            if (!isCurrentClass && inheritancePath.length > 1) {
                html += `<div class="inheritance-path-display">`;
                inheritancePath.forEach((pathClass, index) => {
                    const isLast = index === inheritancePath.length - 1;
                    if (isLast) {
                        html += `<span class="class-link" data-type="${escapeHtml(pathClass)}">${escapeHtml(pathClass)}</span>`;
                    } else {
                        html += `<span class="inheritance-path-class" data-type="${escapeHtml(pathClass)}">${escapeHtml(pathClass)}</span>`;
                        html += `<span class="inheritance-path-arrow"> → </span>`;
                    }
                });
                html += `</div>`;
            } else if (hasReference && !isCurrentClass) {
                const firstRef = matches.find(m => m.referencedFrom && m.referencedVia);
                if (firstRef) {
                    html += `<div class="inheritance-path-display">`;
                    html += `<span class="inheritance-path-class" data-type="${escapeHtml(firstRef.referencedFrom)}">${escapeHtml(firstRef.referencedFrom)}</span>`;
                    html += `<span class="inheritance-path-arrow">.</span>`;
                    html += `<span class="inheritance-path-class">${escapeHtml(firstRef.referencedVia)}</span>`;
                    html += `<span class="inheritance-path-arrow"> → </span>`;
                    html += `<span class="class-link" data-type="${escapeHtml(className)}">${escapeHtml(className)}</span>`;
                    html += `</div>`;
                } else {
                    html += `<span class="class-link" data-type="${escapeHtml(className)}">${escapeHtml(className)}</span>`;
                }
            } else {
                html += `<span class="class-link" data-type="${escapeHtml(className)}">${escapeHtml(className)}</span>`;
            }
            
            html += `<span style="color: var(--text-muted); font-weight: normal; margin-left: 0.5rem;">(${matches.length} match${matches.length !== 1 ? 'es' : ''})</span>`;
            html += `</div>`;

            matches.forEach(match => {
                const badgeClass = match.type;
                let matchName = match.name || match.functionName || className;
                let matchInfo = '';

                if (match.type === 'member') {
                    matchInfo = `${match.typeStr}`;
                    if (match.offset !== null) {
                        matchInfo += ` • 0x${match.offset.toString(16)}`;
                    }
                } else if (match.type === 'function') {
                    matchInfo = 'Function';
                } else if (match.type === 'param') {
                    matchInfo = `Param in ${match.functionName}() • ${match.typeStr}`;
                } else {
                    matchInfo = match.type.charAt(0).toUpperCase() + match.type.slice(1);
                }

                const highlightedName = this.highlightText(matchName, this.advancedSearchQuery || '');
                const highlightedInfo = this.highlightText(matchInfo, this.advancedSearchQuery || '');

                const dataAttrs = `data-match-type="${match.type}" data-class-name="${escapeHtml(className)}"`;
                let extraDataAttrs = '';
                if (match.type === 'member') {
                    extraDataAttrs = `data-member-name="${escapeHtml(match.name)}"`;
                } else if (match.type === 'function') {
                    extraDataAttrs = `data-function-name="${escapeHtml(match.name || match.functionName)}"`;
                } else if (match.type === 'param') {
                    extraDataAttrs = `data-function-name="${escapeHtml(match.functionName)}" data-param-name="${escapeHtml(match.name)}"`;
                }

                html += `<div class="advanced-search-match-item" ${dataAttrs} ${extraDataAttrs} style="cursor: pointer;" title="Double-click to navigate">`;
                html += `<span class="advanced-search-match-badge ${badgeClass}">${badgeClass}</span>`;
                html += `<div class="advanced-search-match-details">`;
                html += `<div class="advanced-search-match-name">${highlightedName}</div>`;
                html += `<div class="advanced-search-match-info">${highlightedInfo}</div>`;
                html += `</div>`;
                html += `</div>`;
            });

            html += `</div>`;
        });

        resultsContainer.innerHTML = html;

        resultsContainer.querySelectorAll('.class-link, .inheritance-path-class').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const typeName = link.getAttribute('data-type');
                if (typeName) {
                    this.closeAdvancedMemberSearch();
                    this.navigateToType(typeName);
                }
            });
        });
        
        resultsContainer.querySelectorAll('.advanced-search-match-item').forEach(item => {
            let isDragging = false;
            let dragStartX = 0;
            let dragStartY = 0;
            let lastClickTime = 0;
            
            item.addEventListener('mousedown', (e) => {
                isDragging = false;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                
                const currentTime = Date.now();
                const timeSinceLastClick = currentTime - lastClickTime;
                
                if (timeSinceLastClick < 400) {
                    e.preventDefault();
                    if (window.getSelection) {
                        window.getSelection().removeAllRanges();
                    }
                    this.navigateToAdvancedSearchResult(item);
                    lastClickTime = 0;
                    return;
                }
                
                lastClickTime = currentTime;
                
                const mouseMoveHandler = (e2) => {
                    const deltaX = Math.abs(e2.clientX - dragStartX);
                    const deltaY = Math.abs(e2.clientY - dragStartY);
                    if (deltaX > 3 || deltaY > 3) {
                        isDragging = true;
                    }
                };
                
                const mouseUpHandler = () => {
                    item.removeEventListener('mousemove', mouseMoveHandler);
                    item.removeEventListener('mouseup', mouseUpHandler);
                };
                
                item.addEventListener('mousemove', mouseMoveHandler);
                item.addEventListener('mouseup', mouseUpHandler);
            });
            
            item.addEventListener('dblclick', (e) => {
                if (!isDragging) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.getSelection) {
                        window.getSelection().removeAllRanges();
                    }
                    this.navigateToAdvancedSearchResult(item);
                }
            });
            
            item.addEventListener('selectstart', (e) => {
                const currentTime = Date.now();
                const timeSinceLastClick = currentTime - lastClickTime;
                if (timeSinceLastClick < 400 && !isDragging) {
                    e.preventDefault();
                }
            });
            
            item.addEventListener('mouseenter', () => {
                item.style.backgroundColor = 'var(--bg-hover)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = '';
            });
        });
    }
    
    navigateToAdvancedSearchResult(itemElement) {
        const matchType = itemElement.getAttribute('data-match-type');
        const className = itemElement.getAttribute('data-class-name');
        
        if (!className) return;
        
        this.closeAdvancedMemberSearch();
        
        if (matchType === 'member') {
            const memberName = itemElement.getAttribute('data-member-name');
            this.navigateToMember(className, memberName);
        } else if (matchType === 'function') {
            const functionName = itemElement.getAttribute('data-function-name');
            this.navigateToFunction(className, functionName);
        } else if (matchType === 'param') {
            const functionName = itemElement.getAttribute('data-function-name');
            const paramName = itemElement.getAttribute('data-param-name');
            this.navigateToFunction(className, functionName, paramName);
        } else if (matchType === 'class' || matchType === 'struct' || matchType === 'enum') {
            this.navigateToType(className);
        }
    }
    
    navigateToMember(className, memberName) {
        this.navigateToType(className);
        
        setTimeout(() => {
            const membersTable = document.getElementById('membersTableBody');
            if (membersTable) {
                const rows = membersTable.querySelectorAll('tr');
                for (const row of rows) {
                    const memberCell = row.querySelector('td:nth-child(2)');
                    if (memberCell && memberCell.textContent.trim() === memberName) {
                        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        row.style.backgroundColor = 'var(--accent-primary)';
                        row.style.transition = 'background-color 2s';
                        setTimeout(() => {
                            row.style.backgroundColor = '';
                        }, 2000);
                        break;
                    }
                }
            }
        }, 200);
    }
    
    navigateToFunction(className, functionName, paramName = null) {
        this.navigateToType(className);
        
        setTimeout(() => {
            const functionBlocks = document.querySelectorAll('.function-block');
            for (const block of functionBlocks) {
                const funcTitle = block.querySelector('.function-title');
                if (funcTitle && funcTitle.textContent.includes(functionName)) {
                    block.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    block.style.borderColor = 'var(--accent-primary)';
                    block.style.transition = 'border-color 2s';
                    
                    if (paramName) {
                        const paramElements = block.querySelectorAll('.param-name');
                        for (const paramEl of paramElements) {
                            if (paramEl.textContent.trim() === paramName) {
                                paramEl.style.backgroundColor = 'var(--accent-primary)';
                                paramEl.style.transition = 'background-color 2s';
                                setTimeout(() => {
                                    paramEl.style.backgroundColor = '';
                                }, 2000);
                                break;
                            }
                        }
                    }
                    
                    setTimeout(() => {
                        block.style.borderColor = '';
                    }, 2000);
                    break;
                }
            }
        }, 200);
    }

    highlightText(text, query) {
        if (!query || !text) return escapeHtml(text);
        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
        return escapeHtml(text).replace(regex, '<span class="highlight">$1</span>');
    }

    openAdvancedMemberSearch() {
        const modal = document.getElementById('advancedMemberSearchModal');
        if (!modal) return;

        const itemType = this.currentDetailItem?.type || this.currentDetailItem?.searchType;
        if (itemType !== 'class' && itemType !== 'classes' && itemType !== 'struct' && itemType !== 'structs') {
            return;
        }

        modal.style.display = 'flex';
        const input = document.getElementById('advancedMemberSearchInput');
        if (input) {
            input.focus();
        }
    }

    closeAdvancedMemberSearch() {
        const modal = document.getElementById('advancedMemberSearchModal');
        if (!modal) return;

        modal.style.display = 'none';
        const input = document.getElementById('advancedMemberSearchInput');
        if (input) {
            input.value = '';
        }
        const results = document.getElementById('advancedMemberSearchResults');
        if (results) {
            results.innerHTML = '';
        }
        this.advancedSearchQuery = '';
    }


    showToast(message, type = 'info', duration = 3000) {
        if (!this.toastContainer) {
            this.toastContainer = document.getElementById('toastContainer');
            if (!this.toastContainer) {
                this.toastContainer = document.createElement('div');
                this.toastContainer.id = 'toastContainer';
                this.toastContainer.className = 'toast-container';
                document.body.appendChild(this.toastContainer);
            }
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = '';
        if (type === 'success') {
            icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
        } else if (type === 'error') {
            icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>';
        } else {
            icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
        }
        
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-message">${escapeHtml(message)}</div>
        `;
        
        this.toastContainer.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.classList.add('toast-show');
        });
        
        setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new DumpspaceApp();
});
