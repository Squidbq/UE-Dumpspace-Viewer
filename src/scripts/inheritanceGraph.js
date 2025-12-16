class InheritanceGraph {
    constructor() {
        this.network = null;
        this.nodes = null;
        this.edges = null;
        this.currentItem = null;
        this.currentMode = 'both';
        this.allNodes = [];
        this.allEdges = [];
        this.filteredNodes = [];
        this.filteredEdges = [];
        this.searchQuery = '';
        this.showMembers = false;
        this.history = [];
        this.historyIndex = -1;
        this.init();
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const modal = document.getElementById('inheritanceGraphModal');
        const closeBtn = document.getElementById('inheritanceGraphClose');
        const overlay = modal?.querySelector('.inheritance-graph-modal-overlay');
        const searchInput = document.getElementById('inheritanceGraphSearchInput');
        const clearSearchBtn = document.getElementById('clearGraphSearchBtn');
        const showParentsCheck = document.getElementById('graphShowParents');
        const showChildrenCheck = document.getElementById('graphShowChildren');
        const showMembersCheck = document.getElementById('graphShowMembers');
        const parentDepthInput = document.getElementById('graphParentDepth');
        const childDepthInput = document.getElementById('graphChildDepth');
        const syncDepthsCheck = document.getElementById('graphSyncDepths');
        const zoomResetBtn = document.getElementById('graphZoomReset');
        const zoomFitBtn = document.getElementById('graphZoomFit');
        const navBackBtn = document.getElementById('graphNavBack');
        const navForwardBtn = document.getElementById('graphNavForward');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        if (overlay) {
            overlay.addEventListener('click', () => this.close());
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && modal.style.display !== 'none') {
                this.close();
            }
        });

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase().trim();
                if (clearSearchBtn) {
                    clearSearchBtn.style.display = this.searchQuery ? 'block' : 'none';
                }
                this.updateGraph();
            });
        }
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                this.searchQuery = '';
                clearSearchBtn.style.display = 'none';
                this.updateGraph();
            });
        }

        if (showParentsCheck) {
            showParentsCheck.addEventListener('change', () => this.updateGraph());
        }
        if (showChildrenCheck) {
            showChildrenCheck.addEventListener('change', () => this.updateGraph());
        }
        if (showMembersCheck) {
            showMembersCheck.addEventListener('change', () => {
                this.showMembers = showMembersCheck.checked;
                this.updateGraph();
            });
        }
        if (syncDepthsCheck && parentDepthInput && childDepthInput) {
            syncDepthsCheck.addEventListener('change', () => {
                if (syncDepthsCheck.checked) {
                    childDepthInput.value = parentDepthInput.value;
                }
            });
            
            parentDepthInput.addEventListener('change', () => {
                if (syncDepthsCheck.checked) {
                    childDepthInput.value = parentDepthInput.value;
                }
                this.updateGraph();
            });
            
            childDepthInput.addEventListener('change', () => {
                if (syncDepthsCheck.checked) {
                    parentDepthInput.value = childDepthInput.value;
                }
                this.updateGraph();
            });
        } else {
            if (parentDepthInput) {
                parentDepthInput.addEventListener('change', () => this.updateGraph());
            }
            if (childDepthInput) {
                childDepthInput.addEventListener('change', () => this.updateGraph());
            }
        }

        if (zoomResetBtn) {
            zoomResetBtn.addEventListener('click', () => this.resetZoom());
        }
        if (zoomFitBtn) {
            zoomFitBtn.addEventListener('click', () => this.fitToScreen());
        }

        if (navBackBtn) {
            navBackBtn.addEventListener('click', () => this.navigateHistory(-1));
        }
        if (navForwardBtn) {
            navForwardBtn.addEventListener('click', () => this.navigateHistory(1));
        }

    }

    open(item, mode = 'both') {
        if (this.network && this.historyIndex >= 0 && this.history[this.historyIndex]) {
            this.saveViewState();
        }
        
        const itemName = item.name || item.className || 'Unknown';
        const historyEntry = { 
            item: item, 
            mode: mode, 
            name: itemName,
            viewState: null
        };
        
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        this.history.push(historyEntry);
        this.historyIndex = this.history.length - 1;
        this.updateNavigationButtons();
        
        this.currentItem = item;
        this.currentMode = mode;
        
        const modal = document.getElementById('inheritanceGraphModal');
        const title = document.getElementById('inheritanceGraphTitle');
        const showParentsCheck = document.getElementById('graphShowParents');
        const showChildrenCheck = document.getElementById('graphShowChildren');
        const container = document.getElementById('inheritanceGraphContainer');

        if (!modal) return;

        if (title) {
            title.textContent = `Inheritance Graph: ${itemName}`;
        }

        if (mode === 'parents') {
            if (showParentsCheck) showParentsCheck.checked = true;
            if (showChildrenCheck) showChildrenCheck.checked = false;
        } else if (mode === 'children') {
            if (showParentsCheck) showParentsCheck.checked = false;
            if (showChildrenCheck) showChildrenCheck.checked = true;
        } else {
            if (showParentsCheck) showParentsCheck.checked = true;
            if (showChildrenCheck) showChildrenCheck.checked = true;
        }

        modal.style.display = 'flex';

        if (container) {
            container.innerHTML = '<div class="graph-loading"><div class="graph-loading-spinner"></div><div class="graph-loading-text">Building graph...</div></div>';
        }

        setTimeout(() => {
            this.buildGraphAsync().then(() => {
                this.renderGraph(null);
            });
        }, 100);
    }

    async buildGraphAsync() {
        return new Promise((resolve) => {
            const container = document.getElementById('inheritanceGraphContainer');
            
            const updateProgress = (pct, text) => {
                if (container) {
                    const loadingDiv = container.querySelector('.graph-loading');
                    if (loadingDiv) {
                        const textDiv = loadingDiv.querySelector('.graph-loading-text');
                        if (textDiv) {
                            textDiv.textContent = `${text} (${pct}%)`;
                        }
                    } else {
                        container.innerHTML = `<div class="graph-loading"><div class="graph-loading-spinner"></div><div class="graph-loading-text">${text} (${pct}%)</div></div>`;
                    }
                }
            };
            
            try {
                requestAnimationFrame(() => {
                    updateProgress(20, 'Initializing...');
                    requestAnimationFrame(() => {
                        updateProgress(50, 'Building tree...');
                        requestAnimationFrame(() => {
                            try {
                                this.buildGraph();
                                updateProgress(90, 'Finalizing...');
                                requestAnimationFrame(() => {
                                    resolve();
                                });
                            } catch (error) {
                                updateProgress(100, 'Error building graph');
                                setTimeout(() => resolve(), 100);
                            }
                        });
                    });
                });
            } catch (error) {
                resolve();
            }
        });
    }

    close() {
        const modal = document.getElementById('inheritanceGraphModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.searchQuery = '';
        const searchInput = document.getElementById('inheritanceGraphSearchInput');
        if (searchInput) searchInput.value = '';
    }

    buildGraph() {
        if (!this.currentItem || !window.inheritanceViewer) return;

        const itemName = this.currentItem.name || this.currentItem.className;
        if (!itemName) return;


        this.allNodes = [];
        this.allEdges = [];
        const nodeMap = new Map();
        const visited = new Set();
        
        const classStructCache = new Map();
        const inheritanceCache = new Map();
        const typeExtractionCache = new Map();
        
        window.app.indexes.classes.forEach((item, name) => {
            classStructCache.set(name, item);
        });
        window.app.indexes.structs.forEach((item, name) => {
            classStructCache.set(name, item);
        });
        
        this.classColors = new Map();
        const colorPalette = [
            '#6b7fd7',
            '#4caf50',
            '#ff9800',
            '#e91e63',
            '#00bcd4',
            '#9c27b0',
            '#f44336',
            '#2196f3',
            '#ffeb3b',
            '#795548',
            '#607d8b',
            '#ff5722'
        ];
        let colorIndex = 0;

        const parentDepthInput = document.getElementById('graphParentDepth');
        const childDepthInput = document.getElementById('graphChildDepth');
        const parentDepth = parentDepthInput ? parseInt(parentDepthInput.value) || 2 : 2;
        const childDepth = childDepthInput ? parseInt(childDepthInput.value) || 2 : 2;
        
        const showMembersCheck = document.getElementById('graphShowMembers');
        const showMembers = showMembersCheck ? showMembersCheck.checked : false;
        
        
        const getClassColor = (className) => {
            if (!this.classColors.has(className)) {
                this.classColors.set(className, colorPalette[colorIndex % colorPalette.length]);
                colorIndex++;
            }
            return this.classColors.get(className);
        };
        this.getClassColor = getClassColor;
        
        this.classStructCache = classStructCache;
        this.inheritanceCache = inheritanceCache;
        this.typeExtractionCache = typeExtractionCache;

        const currentNode = {
            id: itemName,
            label: itemName,
            type: this.currentItem.type || 'class',
            isCurrent: true,
            level: 0
        };
        nodeMap.set(itemName, currentNode);
        visited.add(itemName);

        const showParentsCheck = document.getElementById('graphShowParents');
        if (showParentsCheck && showParentsCheck.checked && parentDepth > 0) {
            const inheritInfo = window.inheritanceViewer.getInheritanceInfo(this.currentItem);
            if (inheritInfo && inheritInfo.length > 0) {
                inheritInfo.forEach((parentName, index) => {
                    if (!visited.has(parentName) && (index + 1) <= parentDepth) {
                        const parentNode = {
                            id: parentName,
                            label: parentName,
                            type: 'class',
                            isCurrent: false,
                            level: -(index + 1)
                        };
                        nodeMap.set(parentName, parentNode);
                        visited.add(parentName);
                        this.allEdges.push({
                            from: parentName,
                            to: itemName,
                            arrows: 'to'
                        });
                    }
                });
            }
        }

        const showChildrenCheck = document.getElementById('graphShowChildren');
        if (showChildrenCheck && showChildrenCheck.checked && childDepth > 0) {
            const children = window.inheritanceViewer.findChildren(itemName);
            this.addChildrenRecursive(itemName, children, nodeMap, visited, 1, childDepth);
        }
        

        if (showMembers) {
            const classesToProcess = [];
            
            nodeMap.forEach((node, key) => {
                const className = key;
                
                const isMemberNode = node.type === 'member' || className.includes('::');
                
                if (!isMemberNode) {
                    const nodeLevel = node.level;
                    let withinDepth = false;
                    
                    if (nodeLevel === 0) {
                        withinDepth = true;
                    } else if (nodeLevel < 0) {
                        withinDepth = Math.abs(nodeLevel) <= parentDepth;
                    } else if (nodeLevel > 0) {
                        withinDepth = nodeLevel <= childDepth;
                    }
                    
                    if (withinDepth) {

                        const classExists = window.app.indexes.classes.has(className) || 
                                           window.app.indexes.structs.has(className);
                        if (classExists) {
                            classesToProcess.push(className);
                        }
                    }
                }
            });
            
            
            const visitedTypeRefs = new Set();
            classesToProcess.forEach(className => {
                const node = nodeMap.get(className);
                const isChildClass = node && node.level > 0;
                this.addMembersToGraph(className, nodeMap, isChildClass, 0, visitedTypeRefs);
            });
            
        }

        this.allNodes = Array.from(nodeMap.values());
        
        const classNodes = this.allNodes.filter(n => n.type !== 'member').length;
        const memberNodes = this.allNodes.filter(n => n.type === 'member').length;
        const memberNodesByClass = {};
        this.allNodes.filter(n => n.type === 'member').forEach(member => {
            const parentClass = member.parentClass || 'Unknown';
            if (!memberNodesByClass[parentClass]) {
                memberNodesByClass[parentClass] = 0;
            }
            memberNodesByClass[parentClass]++;
        });
        
    }

    addMembersToGraph(className, nodeMap, includeInherited = false, typeReferenceDepth = 0, visitedTypeRefs = new Set()) {
        const classItem = this.classStructCache ? this.classStructCache.get(className) : 
                         (window.app.indexes.classes.get(className) || window.app.indexes.structs.get(className));
        
        if (!classItem || !classItem.data || !Array.isArray(classItem.data)) {
            return;
        }

        const classLevel = nodeMap.get(className)?.level || 0;
        const classColor = this.getClassColor ? this.getClassColor(className) : '#6b7fd7';
        let memberCount = 0;
        const maxMembersPerClass = 50;
        
        const parentDepthInput = document.getElementById('graphParentDepth');
        const childDepthInput = document.getElementById('graphChildDepth');
        const childDepth = childDepthInput ? parseInt(childDepthInput.value) || 0 : 0;
        
        
        const inheritedMembers = new Map();
        if (includeInherited && window.inheritanceViewer) {
            let inheritInfo = this.inheritanceCache ? this.inheritanceCache.get(className) : null;
            if (!inheritInfo) {
                inheritInfo = window.inheritanceViewer.getInheritanceInfo(classItem);
                if (this.inheritanceCache) {
                    this.inheritanceCache.set(className, inheritInfo);
                }
            }
            if (inheritInfo && inheritInfo.length > 0) {
                for (const parentName of inheritInfo) {
                    const parentItem = this.classStructCache ? this.classStructCache.get(parentName) : 
                                     (window.app.indexes.classes.get(parentName) || window.app.indexes.structs.get(parentName));
                    if (parentItem && parentItem.data && Array.isArray(parentItem.data)) {
                        for (const member of parentItem.data) {
                            if (typeof member === 'object' && member !== null) {
                                const entries = Object.entries(member);
                                for (const [memberName, memberData] of entries) {
                                    if (memberName === '__InheritInfo' || memberName === '__MDKClassSize') {
                                        continue;
                                    }
                                    if (!inheritedMembers.has(memberName) && Array.isArray(memberData) && memberData.length >= 2) {
                                        inheritedMembers.set(memberName, {
                                            parentClass: parentName,
                                            memberData: memberData
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        
        const memberOffset = (classLevel * 0.1) + (memberCount * 0.01);

        let skippedCount = 0;
        let skippedReasons = {};
        
        for (const member of classItem.data) {
            if (memberCount >= maxMembersPerClass) break;
            
            if (typeof member === 'object' && member !== null) {
                const entries = Object.entries(member);
                for (const [memberName, memberData] of entries) {
                    if (memberCount >= maxMembersPerClass) break;
                    
                    if (memberName === '__InheritInfo' || memberName === '__MDKClassSize') {
                        skippedCount++;
                        if (!skippedReasons['special']) skippedReasons['special'] = 0;
                        skippedReasons['special']++;
                        continue;
                    }

                    if (Array.isArray(memberData) && memberData.length >= 2) {
                        const typeInfo = memberData[0];
                        
                        let typeStr = 'Unknown';
                        if (Array.isArray(typeInfo) && typeInfo.length > 0) {
                            typeStr = window.inheritanceViewer.formatType(typeInfo);
                        }
                        
                        const memberNodeId = `${className}::${memberName}`;
                        if (!nodeMap.has(memberNodeId)) {
                            const shortType = typeStr.length > 25 ? typeStr.substring(0, 22) + '...' : typeStr;
                            const shortClassName = className.length > 15 ? className.substring(0, 12) + '...' : className;
                            const memberNode = {
                                id: memberNodeId,
                                label: `${shortClassName}::${memberName}\n└─ ${shortType}`,
                                type: 'member',
                                isCurrent: false,
                                level: classLevel + 0.5 + memberOffset,
                                parentClass: className,
                                memberName: memberName,
                                memberType: typeStr,
                                memberColor: classColor
                            };
                            nodeMap.set(memberNodeId, memberNode);
                            memberCount++;
                            
                            this.allEdges.push({
                                from: className,
                                to: memberNodeId,
                                arrows: 'to',
                                color: classColor,
                                dashes: true,
                                width: 2
                            });
                            
                            const typeInfoKey = Array.isArray(typeInfo) ? JSON.stringify(typeInfo) : String(typeInfo);
                            let referencedClasses = this.typeExtractionCache ? this.typeExtractionCache.get(typeInfoKey) : null;
                            if (!referencedClasses) {
                                referencedClasses = this.extractClassNamesFromType(typeInfo);
                                if (this.typeExtractionCache) {
                                    this.typeExtractionCache.set(typeInfoKey, referencedClasses);
                                }
                            }
                            referencedClasses.forEach(refClass => {
                                if ((typeReferenceDepth + 1) <= childDepth && !visitedTypeRefs.has(refClass)) {
                                    visitedTypeRefs.add(refClass);
                                    
                                    if (!nodeMap.has(refClass)) {
                                        const refClassItem = this.classStructCache ? this.classStructCache.get(refClass) : 
                                                           (window.app.indexes.classes.get(refClass) || window.app.indexes.structs.get(refClass));
                                        if (refClassItem) {
                                            const refClassLevel = 100 + typeReferenceDepth;
                                            const refClassNode = {
                                                id: refClass,
                                                label: refClass,
                                                type: 'class',
                                                isCurrent: false,
                                                level: refClassLevel,
                                                isTypeReference: true
                                            };
                                            nodeMap.set(refClass, refClassNode);
                                            
                                            this.addMembersToGraph(refClass, nodeMap, false, typeReferenceDepth + 1, visitedTypeRefs);
                                        }
                                    }
                                    
                                    this.allEdges.push({
                                        from: memberNodeId,
                                        to: refClass,
                                        arrows: 'to',
                                        color: '#9b59b6',
                                        dashes: [5, 5],
                                        width: 1
                                    });
                                } else if (nodeMap.has(refClass)) {
                                    this.allEdges.push({
                                        from: memberNodeId,
                                        to: refClass,
                                        arrows: 'to',
                                        color: '#9b59b6',
                                        dashes: [5, 5],
                                        width: 1
                                    });
                                }
                            });
                        }
                    } else {
                        skippedCount++;
                        const reason = Array.isArray(memberData) ? 'array_too_short' : 'not_array';
                        if (!skippedReasons[reason]) skippedReasons[reason] = 0;
                        skippedReasons[reason]++;
                    }
                }
            } else {
                skippedCount++;
                if (!skippedReasons['not_object']) skippedReasons['not_object'] = 0;
                skippedReasons['not_object']++;
            }
        }
        
        if (includeInherited && inheritedMembers.size > 0) {
            let inheritedCount = 0;
            for (const [memberName, {parentClass, memberData}] of inheritedMembers) {
                if (memberCount >= maxMembersPerClass) break;
                
                const typeInfo = memberData[0];
                
                let typeStr = 'Unknown';
                if (Array.isArray(typeInfo) && typeInfo.length > 0) {
                    typeStr = window.inheritanceViewer.formatType(typeInfo);
                }
                
                const memberNodeId = `${className}::${memberName}`;
                
                let memberNode = nodeMap.get(memberNodeId);
                
                if (!memberNode) {
                    const shortType = typeStr.length > 25 ? typeStr.substring(0, 22) + '...' : typeStr;
                    const shortClassName = className.length > 15 ? className.substring(0, 12) + '...' : className;
                    memberNode = {
                        id: memberNodeId,
                        label: `${shortClassName}::${memberName}\n└─ ${typeStr}\n(inherited from ${parentClass})`,
                        type: 'member',
                        isCurrent: false,
                        level: classLevel + 0.5 + memberOffset,
                        parentClass: className,
                        inheritedFrom: parentClass,
                        memberName: memberName,
                        memberType: typeStr,
                        memberColor: classColor
                    };
                    nodeMap.set(memberNodeId, memberNode);
                    memberCount++;
                    inheritedCount++;
                } else {
                    memberCount++;
                    inheritedCount++;
                }
                
                const edgeExists = this.allEdges.some(e => e.from === className && e.to === memberNodeId);
                if (!edgeExists) {
                    this.allEdges.push({
                        from: className,
                        to: memberNodeId,
                        arrows: 'to',
                        color: classColor,
                        dashes: true,
                        width: 2
                    });
                }
                
                const typeInfoKey = Array.isArray(typeInfo) ? JSON.stringify(typeInfo) : String(typeInfo);
                let referencedClasses = this.typeExtractionCache ? this.typeExtractionCache.get(typeInfoKey) : null;
                if (!referencedClasses) {
                    referencedClasses = this.extractClassNamesFromType(typeInfo);
                    if (this.typeExtractionCache) {
                        this.typeExtractionCache.set(typeInfoKey, referencedClasses);
                    }
                }
                referencedClasses.forEach(refClass => {
                    if ((typeReferenceDepth + 1) <= childDepth && !visitedTypeRefs.has(refClass)) {
                        visitedTypeRefs.add(refClass);
                        
                        if (!nodeMap.has(refClass)) {
                            const refClassItem = this.classStructCache ? this.classStructCache.get(refClass) : 
                                               (window.app.indexes.classes.get(refClass) || window.app.indexes.structs.get(refClass));
                            if (refClassItem) {
                                const refClassLevel = 100 + typeReferenceDepth;
                                const refClassNode = {
                                    id: refClass,
                                    label: refClass,
                                    type: 'class',
                                    isCurrent: false,
                                    level: refClassLevel,
                                    isTypeReference: true
                                };
                                nodeMap.set(refClass, refClassNode);
                                
                                this.addMembersToGraph(refClass, nodeMap, false, typeReferenceDepth + 1, visitedTypeRefs);
                            }
                        }
                        
                        this.allEdges.push({
                            from: memberNodeId,
                            to: refClass,
                            arrows: 'to',
                            color: '#9b59b6',
                            dashes: [5, 5],
                            width: 1
                        });
                    } else if (nodeMap.has(refClass)) {
                        this.allEdges.push({
                            from: memberNodeId,
                            to: refClass,
                            arrows: 'to',
                            color: '#9b59b6',
                            dashes: [5, 5],
                            width: 1
                        });
                    }
                });
            }
        }
    }

    extractClassNamesFromType(typeInfo) {
        const classNames = [];
        
        if (!Array.isArray(typeInfo)) {
            return classNames;
        }
        
        const extract = (arr) => {
            if (!Array.isArray(arr)) {
                if (typeof arr === 'string') {
                    if (/^[AUFT][A-Z]/.test(arr)) {
                        const classItem = window.app.indexes.classes.get(arr) || 
                                         window.app.indexes.structs.get(arr);
                        if (classItem) {
                            classNames.push(arr);
                        }
                    }
                }
                return;
            }
            
            arr.forEach(item => {
                if (Array.isArray(item)) {
                    extract(item);
                } else if (typeof item === 'string') {
                    if (/^[AUFT][A-Z]/.test(item)) {
                        const classItem = window.app.indexes.classes.get(item) || 
                                         window.app.indexes.structs.get(item);
                        if (classItem && !classNames.includes(item)) {
                            classNames.push(item);
                        }
                    }
                }
            });
        };
        
        extract(typeInfo);
        return classNames;
    }

    addChildrenRecursive(parentName, children, nodeMap, visited, currentDepth, maxDepth) {
        if (currentDepth > maxDepth) return;

        children.forEach(childName => {
            if (!visited.has(childName)) {
                const childNode = {
                    id: childName,
                    label: childName,
                    type: 'class',
                    isCurrent: false,
                    level: currentDepth
                };
                nodeMap.set(childName, childNode);
                visited.add(childName);
                this.allEdges.push({
                    from: parentName,
                    to: childName,
                    arrows: 'to'
                });

                const grandchildren = window.inheritanceViewer.findChildren(childName);
                if (grandchildren.length > 0) {
                    this.addChildrenRecursive(childName, grandchildren, nodeMap, visited, currentDepth + 1, maxDepth);
                }
            }
        });
    }

    filterGraph() {
        this.filteredNodes = this.allNodes;
        this.filteredEdges = this.allEdges;
        
        if (!this.searchQuery) {
            this.matchingNodeIds = new Set();
        } else {
            const query = this.searchQuery.toLowerCase();
            this.matchingNodeIds = new Set();
            
            this.allNodes.forEach(node => {
                const matches = node.label.toLowerCase().includes(query) || 
                               (node.memberName && node.memberName.toLowerCase().includes(query)) ||
                               (node.parentClass && node.parentClass.toLowerCase().includes(query));
                if (matches) {
                    this.matchingNodeIds.add(node.id);
                }
            });
        }

    }

    updateGraph() {
        const container = document.getElementById('inheritanceGraphContainer');
        if (container) {
            container.innerHTML = '<div class="graph-loading"><div class="graph-loading-spinner"></div><div class="graph-loading-text">Updating graph...</div></div>';
        }
        const oldNetwork = this.network;
        this.network = null;
        
        this.buildGraphAsync().then(() => {
            this.filterGraph();
            this.renderGraph(null);
        }).catch((error) => {
            const container = document.getElementById('inheritanceGraphContainer');
            if (container) {
                container.innerHTML = '<div class="graph-loading"><div class="graph-loading-text">Error updating graph. Please try again.</div></div>';
            }
        });
    }

    renderGraph(savedViewState = null) {
        const container = document.getElementById('inheritanceGraphContainer');
        if (!container) return;

        if (typeof vis === 'undefined') {
            setTimeout(() => this.renderGraph(savedViewState), 100);
            return;
        }

        this.filteredNodes = this.allNodes;
        this.filteredEdges = this.allEdges;
        if (!this.matchingNodeIds) {
            this.matchingNodeIds = new Set();
        }
        

        const data = {
            nodes: new vis.DataSet(this.filteredNodes.map(node => {
                const isMember = node.type === 'member';
                const isCurrent = node.isCurrent;
                
                
                const memberColor = node.memberColor || '#6b7fd7';
                const headerColor = isCurrent ? '#4a9eff' : isMember ? memberColor : '#4caf50';
                
                const labelParts = node.label.split('\n');
                const headerText = labelParts[0];
                const bodyText = labelParts.length > 1 ? labelParts[1] : '';
                
                const formattedLabel = bodyText ? `${headerText}\n${bodyText}` : headerText;
                
                const lightenColor = (color, percent) => {
                    if (!color || !color.startsWith('#')) return color;
                    const num = parseInt(color.replace('#', ''), 16);
                    const r = Math.min(255, (num >> 16) + percent);
                    const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
                    const b = Math.min(255, (num & 0x0000FF) + percent);
                    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
                };
                
                const isMatch = this.matchingNodeIds && this.matchingNodeIds.has(node.id);
                const searchHighlightColor = '#ffeb3b';
                
                return {
                    id: node.id,
                    label: formattedLabel,
                    color: {
                        background: isMatch ? searchHighlightColor : headerColor,
                        border: isMatch ? '#ffc107' : (isMember ? memberColor : '#ffffff'),
                        highlight: { 
                            background: isCurrent ? '#5ba8ff' : isMember ? lightenColor(memberColor, 20) : '#66bb6a', 
                            border: isMember ? memberColor : '#ffffff',
                            borderWidth: 3
                        }
                    },
                    font: { 
                        color: '#ffffff',
                        size: isMember ? 9 : 11,
                        face: isMember ? 'monospace' : 'Arial',
                        align: 'center',
                        multi: true,
                        bold: false
                    },
                    shape: 'box',
                    borderWidth: 2,
                    level: node.level,
                    size: isMember ? 30 : 40,
                    margin: 8,
                    widthConstraint: {
                        maximum: isMember ? 400 : 500
                    },
                    scaling: {
                        min: 0.1,
                        max: 10
                    },
                    title: node.label,
                    shadow: {
                        enabled: true,
                        color: 'rgba(0,0,0,0.3)',
                        size: 5,
                        x: 2,
                        y: 2
                    },
                    chosen: {
                        node: (values, id, selected, hovering) => {
                            if (selected || hovering) {
                                values.borderWidth = 3;
                                values.borderColor = '#ffffff';
                                values.shadow = {
                                    enabled: true,
                                    color: 'rgba(74, 158, 255, 0.5)',
                                    size: 10,
                                    x: 0,
                                    y: 0
                                };
                            }
                        }
                    }
                };
            })),
            edges: new vis.DataSet(this.filteredEdges.map(edge => ({
                from: edge.from,
                to: edge.to,
                arrows: edge.arrows || 'to',
                color: { 
                    color: edge.color || '#ffffff', 
                    highlight: edge.color || '#4a9eff',
                    opacity: 0.8
                },
                width: edge.width || 2,
                dashes: edge.dashes || false,
                smooth: { 
                    type: 'straightCross', 
                    roundness: 0,
                    forceDirection: 'vertical'
                }
            })))
        };

        const options = {
            layout: {
                hierarchical: {
                    direction: 'UD',
                    sortMethod: 'directed',
                    nodeSpacing: 300,
                    levelSeparation: 400,
                    treeSpacing: 350,
                    blockShifting: true,
                    edgeMinimization: true,
                    parentCentralization: true,
                    shakeTowards: 'leaves'
                }
            },
            physics: {
                enabled: false,
                stabilization: {
                    iterations: 100,
                    fit: true
                }
            },
            interaction: {
                dragNodes: true,
                dragView: true,
                zoomView: true,
                zoomSpeed: 1.0,
                tooltipDelay: 200
            },
            nodes: {
                font: {
                    size: 14
                },
                margin: 10,
                widthConstraint: {
                    maximum: 500
                },
                shapeProperties: {
                    useBorderWithImage: true
                },
                scaling: {
                    min: 0.1,
                    max: 10,
                    label: {
                        enabled: true,
                        min: 8,
                        max: 30
                    }
                },
                opacity: 1.0,
                hidden: false
            },
            edges: {
                arrows: {
                    to: {
                        enabled: true,
                        scaleFactor: 1.2,
                        type: 'arrow'
                    }
                },
                length: 200,
                smooth: {
                    type: 'straightCross',
                    roundness: 0,
                    forceDirection: 'vertical'
                },
                width: 2.5,
                color: {
                    color: '#4a9eff',
                    highlight: '#5ba8ff',
                    opacity: 1.0
                },
                selectionWidth: 4,
                font: {
                    color: '#4a9eff',
                    size: 10,
                    align: 'middle',
                    strokeWidth: 3,
                    strokeColor: '#1e1e1e'
                }
            }
        };

        this.network = new vis.Network(container, data, options);
        
        if (container) {
            container.addEventListener('wheel', (event) => {
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    const scale = this.network.getScale();
                    
                    const zoomFactor = event.deltaY > 0 ? 0.90 : 1.10;
                    const newScale = scale * zoomFactor;
                    
                    const minZoom = 0.1;
                    const maxZoom = 10;
                    const clampedScale = Math.max(minZoom, Math.min(maxZoom, newScale));
                    
                    const viewPosition = this.network.getViewPosition();
                    
                    this.network.moveTo({
                        scale: clampedScale,
                        position: viewPosition,
                        animation: false
                    });
                }
            }, { passive: false });
        }

        this.network.on('dragEnd', () => {
            this.saveViewState();
        });
        this.network.on('zoom', (params) => {
            const scale = params.scale || (this.network ? this.network.getScale() : 1);
            if (this.network && this.network.body && this.network.body.data) {
                const nodeCount = this.network.body.data.nodes.length;
                const edgeCount = this.network.body.data.edges.length;
                
                let renderedNodeCount = nodeCount;
                try {
                    if (this.network.body && this.network.body.nodes) {
                        renderedNodeCount = Object.keys(this.network.body.nodes).length;
                    }
                } catch (e) {
                }
                
            }
            this.saveViewState();
        });

        if (savedViewState) {
            setTimeout(() => {
                this.restoreViewState(savedViewState);
            }, 100);
        } else {
            const zoomToCurrent = () => {
                const currentNode = this.filteredNodes.find(n => n.isCurrent);
                if (currentNode && this.network) {
                    this.network.focus(currentNode.id, {
                        scale: 1.8,
                        animation: {
                            duration: 600,
                            easingFunction: 'easeInOutQuad'
                        }
                    });
                }
            };

            this.network.once('stabilizationEnd', zoomToCurrent);
            setTimeout(() => {
                if (this.network) {
                    zoomToCurrent();
                }
            }, 500);
        }
        
        setTimeout(() => {
            if (this.network && this.historyIndex >= 0 && this.history[this.historyIndex]) {
                this.saveViewState();
            }
        }, 1000);

        this.rightClickNodeId = null;
        
        container.addEventListener('mousedown', (event) => {
            if (event.button === 2) {
                if (!this.network) return;
                
                const rect = container.getBoundingClientRect();
                const canvasX = event.clientX - rect.left;
                const canvasY = event.clientY - rect.top;
                
                const pointer = {x: canvasX, y: canvasY};
                const nodeAtPosition = this.network.getNodeAt(pointer);
                
                if (nodeAtPosition) {
                    this.rightClickNodeId = nodeAtPosition;
                }
            }
        });
        
        container.addEventListener('contextmenu', (event) => {
            if (!this.network || !this.rightClickNodeId) {
                this.rightClickNodeId = null;
                return;
            }
            
            const node = this.allNodes.find(n => n.id === this.rightClickNodeId);
            
            if (node) {
                event.preventDefault();
                this.showContextMenu(event, this.rightClickNodeId, node);
            }
            
            this.rightClickNodeId = null;
        });
        
        this.network.on('click', (params) => {
            this.rightClickNodeId = null;
            
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const node = this.filteredNodes.find(n => n.id === nodeId);
                if (node && node.type !== 'member') {
                    this.focusOnNode(nodeId);
                }
            }
        });

        this.network.on('doubleClick', (params) => {
            if (params.nodes && params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const node = this.allNodes.find(n => n.id === nodeId);
                
                if (node && node.type === 'member') {
                    const className = node.parentClass;
                    const memberName = node.memberName;
                    
                    const classItem = window.app.indexes.classes.get(className) || 
                                   window.app.indexes.structs.get(className);
                    
                    if (classItem) {
                        const modal = document.getElementById('inheritanceGraphModal');
                        if (modal) {
                            modal.style.display = 'none';
                        }
                        
                        const category = window.app.indexes.classes.has(className) ? 'classes' : 'structs';
                        window.app.switchCategory(category, classItem);
                        
                        setTimeout(() => {
                            let memberElement = document.querySelector(`[data-member-name="${memberName.toLowerCase()}"]`);
                            
                            if (!memberElement) {
                                const allRows = document.querySelectorAll('tr[data-member-name]');
                                for (const row of allRows) {
                                    const rowMemberName = row.getAttribute('data-member-name');
                                    if (rowMemberName && rowMemberName.toLowerCase() === memberName.toLowerCase()) {
                                        memberElement = row;
                                        break;
                                    }
                                }
                            }
                            
                            if (memberElement) {
                                memberElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                const originalBg = memberElement.style.backgroundColor;
                                memberElement.style.backgroundColor = 'rgba(74, 158, 255, 0.3)';
                                memberElement.style.transition = 'background-color 0.3s';
                                setTimeout(() => {
                                    memberElement.style.backgroundColor = originalBg || '';
                                }, 2000);
                            }
                        }, 300);
                    }
                } else if (node && (node.type === 'class' || !node.type)) {
                    const className = node.id;
                    const classItem = window.app.indexes.classes.get(className) || 
                                   window.app.indexes.structs.get(className);
                    
                    if (classItem) {
                        const modal = document.getElementById('inheritanceGraphModal');
                        if (modal) {
                            modal.style.display = 'none';
                        }
                        
                        const category = window.app.indexes.classes.has(className) ? 'classes' : 'structs';
                        window.app.switchCategory(category, classItem);
                    }
                }
            }
        });

        this.updateInfo();
    }
    
    showContextMenu(event, nodeId, node) {
        const existingMenu = document.getElementById('graphContextMenu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        const parentNodes = [];
        const childNodes = [];
        
        const typeReferenceNodes = [];
        
        const memberNodes = [];
        
        this.allEdges.forEach(edge => {
            if (edge.to === nodeId) {
                const parentNode = this.allNodes.find(n => n.id === edge.from && n.type !== 'member');
                if (parentNode && !edge.dashes) {
                    parentNodes.push(parentNode);
                }
            } else if (edge.from === nodeId) {
                const childNode = this.allNodes.find(n => n.id === edge.to && n.type !== 'member');
                if (childNode && !edge.dashes) {
                    childNodes.push(childNode);
                }
            }
        });
        
        if (node.type === 'member') {
            this.allEdges.forEach(edge => {
                if (edge.from === nodeId && edge.color === '#9b59b6' && edge.dashes) {
                    const typeNode = this.allNodes.find(n => n.id === edge.to && n.type !== 'member');
                    if (typeNode) {
                        typeReferenceNodes.push(typeNode);
                    }
                }
            });
        }
        
        if (node.type !== 'member') {
            const classMembers = this.allNodes.filter(n => 
                n.type === 'member' && n.parentClass === nodeId
            );
            
            classMembers.forEach(memberNode => {
                memberNodes.push(memberNode);
                
                this.allEdges.forEach(edge => {
                    if (edge.from === memberNode.id && edge.color === '#9b59b6' && edge.dashes) {
                        const typeNode = this.allNodes.find(n => n.id === edge.to && n.type !== 'member');
                        if (typeNode && !typeReferenceNodes.find(n => n.id === typeNode.id)) {
                            typeReferenceNodes.push(typeNode);
                        }
                    }
                });
            });
        }
        
        if (parentNodes.length === 0 && childNodes.length === 0 && typeReferenceNodes.length === 0 && memberNodes.length === 0) {
            return;
        }
        
        const menu = document.createElement('div');
        menu.id = 'graphContextMenu';
        menu.style.cssText = `
            position: fixed;
            background: #2d2d2d;
            border: 1px solid #4a9eff;
            border-radius: 4px;
            padding: 4px 0;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            min-width: 150px;
        `;
        
        if (parentNodes.length > 0) {
            if (parentNodes.length === 1) {
                const item = document.createElement('div');
                item.textContent = `Follow up: ${parentNodes[0].label}`;
                item.style.cssText = `
                    padding: 8px 16px;
                    cursor: pointer;
                    color: #ffffff;
                    font-size: 13px;
                `;
                item.onmouseenter = () => item.style.background = '#3a3a3a';
                item.onmouseleave = () => item.style.background = 'transparent';
                item.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.navigateToNodeInGraph(parentNodes[0].id);
                    menu.remove();
                    return false;
                };
                menu.appendChild(item);
            } else {
                const parentItem = document.createElement('div');
                parentItem.textContent = 'Follow up ▼';
                parentItem.style.cssText = `
                    padding: 8px 16px;
                    cursor: pointer;
                    color: #ffffff;
                    font-size: 13px;
                    border-bottom: 1px solid #3a3a3a;
                `;
                
                const submenu = document.createElement('div');
                submenu.style.cssText = `
                    display: none;
                    background: #1e1e1e;
                    border-top: 1px solid #3a3a3a;
                    max-height: 400px;
                    overflow-y: auto;
                    position: fixed;
                    min-width: 200px;
                    z-index: 10001;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                `;
                
                parentNodes.forEach(parentNode => {
                    const subItem = document.createElement('div');
                    subItem.textContent = parentNode.label;
                    subItem.style.cssText = `
                        padding: 6px 16px 6px 32px;
                        cursor: pointer;
                        color: #ffffff;
                        font-size: 12px;
                    `;
                    subItem.onmouseenter = () => subItem.style.background = '#3a3a3a';
                    subItem.onmouseleave = () => subItem.style.background = 'transparent';
                    subItem.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.navigateToNodeInGraph(parentNode.id);
                        menu.remove();
                        return false;
                    };
                    submenu.appendChild(subItem);
                });
                
                let submenuTimeout = null;
                let isHovering = false;
                
                const showSubmenu = () => {
                    if (submenuTimeout) clearTimeout(submenuTimeout);
                    isHovering = true;
                    submenu.style.display = 'block';
                    parentItem.style.background = '#3a3a3a';
                    
                    const parentRect = parentItem.getBoundingClientRect();
                    let submenuX = parentRect.right + 2;
                    let submenuY = parentRect.top;
                    
                    const windowWidth = window.innerWidth;
                    if (submenuX + 200 > windowWidth) {
                        submenuX = parentRect.left - 202;
                    }
                    
                    const windowHeight = window.innerHeight;
                    const submenuHeight = Math.min(400, parentNodes.length * 30);
                    if (submenuY + submenuHeight > windowHeight) {
                        submenuY = windowHeight - submenuHeight - 10;
                    }
                    
                    submenu.style.left = submenuX + 'px';
                    submenu.style.top = submenuY + 'px';
                };
                
                const hideSubmenu = () => {
                    isHovering = false;
                    submenuTimeout = setTimeout(() => {
                        if (!isHovering) {
                            submenu.style.display = 'none';
                            parentItem.style.background = 'transparent';
                        }
                    }, 200);
                };
                
                parentItem.onmouseenter = showSubmenu;
                parentItem.onmouseleave = hideSubmenu;
                submenu.onmouseenter = showSubmenu;
                submenu.onmouseleave = hideSubmenu;
                
                menu.appendChild(parentItem);
                menu.appendChild(submenu);
            }
        }
        
        if (childNodes.length > 0) {
            if (parentNodes.length > 0) {
                const separator = document.createElement('div');
                separator.style.cssText = 'height: 1px; background: #3a3a3a; margin: 4px 0;';
                menu.appendChild(separator);
            }
            
            if (childNodes.length === 1) {
                const item = document.createElement('div');
                item.textContent = `Follow down: ${childNodes[0].label}`;
                item.style.cssText = `
                    padding: 8px 16px;
                    cursor: pointer;
                    color: #ffffff;
                    font-size: 13px;
                `;
                item.onmouseenter = () => item.style.background = '#3a3a3a';
                item.onmouseleave = () => item.style.background = 'transparent';
                item.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.navigateToNodeInGraph(childNodes[0].id);
                    menu.remove();
                    return false;
                };
                menu.appendChild(item);
            } else {
                const childItem = document.createElement('div');
                childItem.textContent = 'Follow down ▼';
                childItem.style.cssText = `
                    padding: 8px 16px;
                    cursor: pointer;
                    color: #ffffff;
                    font-size: 13px;
                    position: relative;
                `;
                
                const submenu = document.createElement('div');
                submenu.style.cssText = `
                    display: none;
                    background: #1e1e1e;
                    border-top: 1px solid #3a3a3a;
                    max-height: 400px;
                    overflow-y: auto;
                    position: fixed;
                    min-width: 200px;
                    z-index: 10001;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                `;
                
                childNodes.forEach(childNode => {
                    const subItem = document.createElement('div');
                    subItem.textContent = childNode.label;
                    subItem.style.cssText = `
                        padding: 6px 16px 6px 32px;
                        cursor: pointer;
                        color: #ffffff;
                        font-size: 12px;
                    `;
                    subItem.onmouseenter = () => subItem.style.background = '#3a3a3a';
                    subItem.onmouseleave = () => subItem.style.background = 'transparent';
                    subItem.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.navigateToNodeInGraph(childNode.id);
                        menu.remove();
                        return false;
                    };
                    submenu.appendChild(subItem);
                });
                
                let submenuTimeout = null;
                let isHovering = false;
                const showSubmenu = () => {
                    if (submenuTimeout) clearTimeout(submenuTimeout);
                    isHovering = true;
                    submenu.style.display = 'block';
                    childItem.style.background = '#3a3a3a';
                    
                    const parentRect = childItem.getBoundingClientRect();
                    let submenuX = parentRect.right + 2;
                    let submenuY = parentRect.top;
                    
                    const windowWidth = window.innerWidth;
                    if (submenuX + 200 > windowWidth) {
                        submenuX = parentRect.left - 202;
                    }
                    
                    const windowHeight = window.innerHeight;
                    const submenuHeight = Math.min(400, childNodes.length * 30);
                    if (submenuY + submenuHeight > windowHeight) {
                        submenuY = windowHeight - submenuHeight - 10;
                    }
                    
                    submenu.style.left = submenuX + 'px';
                    submenu.style.top = submenuY + 'px';
                };
                const hideSubmenu = () => {
                    isHovering = false;
                    submenuTimeout = setTimeout(() => {
                        if (!isHovering) {
                            submenu.style.display = 'none';
                            childItem.style.background = 'transparent';
                        }
                    }, 200);
                };
                
                childItem.onmouseenter = showSubmenu;
                childItem.onmouseleave = hideSubmenu;
                submenu.onmouseenter = showSubmenu;
                submenu.onmouseleave = hideSubmenu;
                
                menu.appendChild(childItem);
                menu.appendChild(submenu);
            }
        }
        
        if (memberNodes.length > 0) {
            if (parentNodes.length > 0 || childNodes.length > 0) {
                const separator = document.createElement('div');
                separator.style.cssText = 'height: 1px; background: #3a3a3a; margin: 4px 0;';
                menu.appendChild(separator);
            }
            
            if (memberNodes.length === 1) {
                const item = document.createElement('div');
                const memberName = memberNodes[0].memberName || memberNodes[0].label.split('::')[1] || memberNodes[0].label;
                item.textContent = `Follow member: ${memberName}`;
                item.style.cssText = `
                    padding: 8px 16px;
                    cursor: pointer;
                    color: #ffffff;
                    font-size: 13px;
                `;
                item.onmouseenter = () => item.style.background = '#3a3a3a';
                item.onmouseleave = () => item.style.background = 'transparent';
                item.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.navigateToNodeInGraph(memberNodes[0].id);
                    menu.remove();
                    return false;
                };
                menu.appendChild(item);
            } else {
                const memberItem = document.createElement('div');
                memberItem.textContent = 'Follow member ▼';
                memberItem.style.cssText = `
                    padding: 8px 16px;
                    cursor: pointer;
                    color: #ffffff;
                    font-size: 13px;
                    position: relative;
                `;
                
                const submenu = document.createElement('div');
                submenu.style.cssText = `
                    display: none;
                    background: #1e1e1e;
                    border-top: 1px solid #3a3a3a;
                    max-height: 400px;
                    overflow-y: auto;
                    position: fixed;
                    min-width: 200px;
                    z-index: 10001;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                `;
                
                memberNodes.forEach(memberNode => {
                    const memberName = memberNode.memberName || memberNode.label.split('::')[1] || memberNode.label;
                    const subItem = document.createElement('div');
                    subItem.textContent = memberName;
                    subItem.style.cssText = `
                        padding: 6px 16px 6px 32px;
                        cursor: pointer;
                        color: #ffffff;
                        font-size: 12px;
                    `;
                    subItem.onmouseenter = () => subItem.style.background = '#3a3a3a';
                    subItem.onmouseleave = () => subItem.style.background = 'transparent';
                    subItem.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.navigateToNodeInGraph(memberNode.id);
                        menu.remove();
                        return false;
                    };
                    submenu.appendChild(subItem);
                });
                
                let submenuTimeout = null;
                let isHovering = false;
                
                const showSubmenu = () => {
                    if (submenuTimeout) clearTimeout(submenuTimeout);
                    isHovering = true;
                    submenu.style.display = 'block';
                    memberItem.style.background = '#3a3a3a';
                    
                    const parentRect = memberItem.getBoundingClientRect();
                    let submenuX = parentRect.right + 2;
                    let submenuY = parentRect.top;
                    
                    const windowWidth = window.innerWidth;
                    if (submenuX + 200 > windowWidth) {
                        submenuX = parentRect.left - 202;
                    }
                    
                    const windowHeight = window.innerHeight;
                    const submenuHeight = Math.min(400, memberNodes.length * 30);
                    if (submenuY + submenuHeight > windowHeight) {
                        submenuY = windowHeight - submenuHeight - 10;
                    }
                    
                    submenu.style.left = submenuX + 'px';
                    submenu.style.top = submenuY + 'px';
                };
                
                const hideSubmenu = () => {
                    isHovering = false;
                    submenuTimeout = setTimeout(() => {
                        if (!isHovering) {
                            submenu.style.display = 'none';
                            memberItem.style.background = 'transparent';
                        }
                    }, 200);
                };
                
                memberItem.onmouseenter = showSubmenu;
                memberItem.onmouseleave = hideSubmenu;
                submenu.onmouseenter = showSubmenu;
                submenu.onmouseleave = hideSubmenu;
                
                menu.appendChild(memberItem);
                menu.appendChild(submenu);
            }
        }
        
        if (typeReferenceNodes.length > 0) {
            if (parentNodes.length > 0 || childNodes.length > 0 || memberNodes.length > 0) {
                const separator = document.createElement('div');
                separator.style.cssText = 'height: 1px; background: #3a3a3a; margin: 4px 0;';
                menu.appendChild(separator);
            }
            
            if (typeReferenceNodes.length === 1) {
                const item = document.createElement('div');
                item.textContent = `Follow type: ${typeReferenceNodes[0].label}`;
                item.style.cssText = `
                    padding: 8px 16px;
                    cursor: pointer;
                    color: #ffffff;
                    font-size: 13px;
                `;
                item.onmouseenter = () => item.style.background = '#3a3a3a';
                item.onmouseleave = () => item.style.background = 'transparent';
                item.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.navigateToNodeInGraph(typeReferenceNodes[0].id);
                    menu.remove();
                    return false;
                };
                menu.appendChild(item);
            } else {
                const typeItem = document.createElement('div');
                typeItem.textContent = 'Follow type ▼';
                typeItem.style.cssText = `
                    padding: 8px 16px;
                    cursor: pointer;
                    color: #ffffff;
                    font-size: 13px;
                    position: relative;
                `;
                
                const submenu = document.createElement('div');
                submenu.style.cssText = `
                    display: none;
                    background: #1e1e1e;
                    border-top: 1px solid #3a3a3a;
                    max-height: 400px;
                    overflow-y: auto;
                    position: fixed;
                    min-width: 200px;
                    z-index: 10001;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                `;
                
                typeReferenceNodes.forEach(typeNode => {
                    const subItem = document.createElement('div');
                    subItem.textContent = typeNode.label;
                    subItem.style.cssText = `
                        padding: 6px 16px 6px 32px;
                        cursor: pointer;
                        color: #ffffff;
                        font-size: 12px;
                    `;
                    subItem.onmouseenter = () => subItem.style.background = '#3a3a3a';
                    subItem.onmouseleave = () => subItem.style.background = 'transparent';
                    subItem.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.navigateToNodeInGraph(typeNode.id);
                        menu.remove();
                        return false;
                    };
                    submenu.appendChild(subItem);
                });
                
                let submenuTimeout = null;
                let isHovering = false;
                
                const showSubmenu = () => {
                    if (submenuTimeout) clearTimeout(submenuTimeout);
                    isHovering = true;
                    submenu.style.display = 'block';
                    typeItem.style.background = '#3a3a3a';
                    
                    const parentRect = typeItem.getBoundingClientRect();
                    let submenuX = parentRect.right + 2;
                    let submenuY = parentRect.top;
                    
                    const windowWidth = window.innerWidth;
                    if (submenuX + 200 > windowWidth) {
                        submenuX = parentRect.left - 202;
                    }
                    
                    const windowHeight = window.innerHeight;
                    const submenuHeight = Math.min(400, typeReferenceNodes.length * 30);
                    if (submenuY + submenuHeight > windowHeight) {
                        submenuY = windowHeight - submenuHeight - 10;
                    }
                    
                    submenu.style.left = submenuX + 'px';
                    submenu.style.top = submenuY + 'px';
                };
                
                const hideSubmenu = () => {
                    isHovering = false;
                    submenuTimeout = setTimeout(() => {
                        if (!isHovering) {
                            submenu.style.display = 'none';
                            typeItem.style.background = 'transparent';
                        }
                    }, 200);
                };
                
                typeItem.onmouseenter = showSubmenu;
                typeItem.onmouseleave = hideSubmenu;
                submenu.onmouseenter = showSubmenu;
                submenu.onmouseleave = hideSubmenu;
                
                menu.appendChild(typeItem);
                menu.appendChild(submenu);
            }
        }
        
        let menuX = event.clientX;
        let menuY = event.clientY;
        
        menu.style.visibility = 'hidden';
        document.body.appendChild(menu);
        
        const menuRect = menu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        if (menuX + menuRect.width > windowWidth) {
            menuX = windowWidth - menuRect.width - 10;
        }
        if (menuX < 10) {
            menuX = 10;
        }
        
        if (menuY + menuRect.height > windowHeight) {
            menuY = windowHeight - menuRect.height - 10;
        }
        if (menuY < 10) {
            menuY = 10;
        }
        
        menu.style.left = menuX + 'px';
        menu.style.top = menuY + 'px';
        menu.style.visibility = 'visible';
        
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('mousedown', closeMenu);
                document.removeEventListener('contextmenu', closeMenu);
            }
        };
        setTimeout(() => {
            document.addEventListener('mousedown', closeMenu);
            document.addEventListener('contextmenu', closeMenu);
        }, 100);
    }

    updateGraphData() {
        if (!this.network) {
            return;
        }

        
        if (!this.matchingNodeIds) {
            this.matchingNodeIds = new Set();
        }
        
        const nodes = this.filteredNodes.map(node => {
            const isMember = node.type === 'member';
            const isCurrent = node.isCurrent;
            
            const isMatch = this.matchingNodeIds && this.matchingNodeIds.has(node.id);
            const searchHighlightColor = '#ffeb3b';
            
            const nodeColor = isMatch ? {
                background: searchHighlightColor,
                border: '#ffc107',
                highlight: { background: '#fff59d', border: '#ffc107' }
            } : isCurrent ? {
                background: '#2d2d2d',
                border: '#4a9eff',
                highlight: { background: '#3a3a3a', border: '#5ba8ff' }
            } : isMember ? {
                background: '#2d2d2d',
                border: '#6b7fd7',
                highlight: { background: '#3a3a3a', border: '#8b7fd7' }
            } : {
                background: '#2d2d2d',
                border: '#3a3a3a',
                highlight: { background: '#3a3a3a', border: '#4a9eff' }
            };
            
            return {
                id: node.id,
                label: node.label,
                color: {
                    background: nodeColor.background,
                    border: nodeColor.border,
                    highlight: nodeColor.highlight,
                    opacity: 1.0
                },
                font: { 
                    color: isCurrent ? '#ffffff' : isMember ? '#d0b0f0' : '#e0e0e0', 
                    size: isMember ? 10 : 13,
                    face: isMember ? 'monospace' : 'arial',
                    align: 'center'
                },
                shape: 'box',
                borderWidth: isCurrent ? 2 : 1,
                level: node.level,
                size: isMember ? 30 : 40,
                margin: 12,
                widthConstraint: {
                    maximum: isMember ? 400 : 500
                },
                scaling: {
                    min: 0.1,
                    max: 10
                },
                opacity: 1.0,
                hidden: false,
                chosen: {
                    node: (values, id, selected, hovering) => {
                        if (selected || hovering) {
                            values.borderWidth = 2;
                            values.borderColor = isCurrent ? '#5ba8ff' : isMember ? '#8b7fd7' : '#4a9eff';
                        }
                    }
                }
            };
        });

        const edges = this.filteredEdges.map(edge => {
            const fromNode = this.filteredNodes.find(n => n.id === edge.from);
            const toNode = this.filteredNodes.find(n => n.id === edge.to);
            const isInheritance = fromNode && toNode && fromNode.type !== 'member' && toNode.type !== 'member';
            const isMemberConnection = fromNode && (fromNode.type === 'member' || toNode?.type === 'member');
            
            const isMatchEdge = this.matchingNodeIds && (
                this.matchingNodeIds.has(edge.from) || 
                this.matchingNodeIds.has(edge.to)
            );
            
            return {
                from: edge.from,
                to: edge.to,
                arrows: edge.arrows || 'to',
                color: { 
                    color: isMatchEdge ? '#ffc107' : (isInheritance ? '#4a9eff' : (edge.color || '#6b7fd7')), 
                    highlight: isInheritance ? '#5ba8ff' : (edge.color || '#8b7fd7'),
                    opacity: isMatchEdge ? 1.0 : 0.8
                },
                width: isMatchEdge ? 3 : (isInheritance ? 3 : (edge.width || 2)),
                dashes: edge.dashes || false,
                smooth: { 
                    type: 'straightCross', 
                    roundness: 0,
                    forceDirection: 'vertical'
                },
                label: isInheritance ? 'inherits' : (isMemberConnection ? 'has' : ''),
                font: isInheritance ? {
                    color: '#4a9eff',
                    size: 11,
                    align: 'middle',
                    strokeWidth: 2,
                    strokeColor: '#1a1a1a'
                } : undefined
            };
        });

        const nodeDataSet = new vis.DataSet(nodes);
        const edgeDataSet = new vis.DataSet(edges);
        
        
        let currentView = null;
        let currentScale = 1;
        try {
            currentView = this.network.getViewPosition();
            currentScale = this.network.getScale();
        } catch (e) {
        }
        
        this.network.setData({ nodes: nodeDataSet, edges: edgeDataSet });
        
        setTimeout(() => {
            if (this.network && nodeDataSet) {
                const allNodeIds = nodeDataSet.getIds();
                const visibilityUpdates = allNodeIds.map(id => ({
                    id: id,
                    hidden: false,
                    opacity: 1.0
                }));
                nodeDataSet.update(visibilityUpdates);
                
                this.network.redraw();
                
                if (currentView && currentScale && currentScale > 0.01 && currentScale < 100) {
                    try {
                        this.network.moveTo({
                            position: currentView,
                            scale: currentScale,
                            animation: false
                        });
                    } catch (e) {
                        this.network.fit({ animation: false });
                    }
                } else {
                    if (!this.searchQuery || this.matchingNodeIds.size === 0) {
                        this.network.fit({ animation: false });
                    }
                }
            }
        }, 100);
        
        
        this.updateInfo();
    }

    navigateToNodeInGraph(nodeId) {
        if (!this.network) return;
        
        const existingNode = this.allNodes.find(n => n.id === nodeId);
        
        if (!existingNode) {
            this.focusOnNode(nodeId);
            return;
        }
        
        const currentScale = this.network.getScale();
        const currentPosition = this.network.getViewPosition();
        
        this.allNodes.forEach(node => {
            node.isCurrent = (node.id === nodeId);
        });
        
        const classItem = window.app.indexes.classes.get(nodeId);
        const structItem = window.app.indexes.structs.get(nodeId);
        this.currentItem = classItem || structItem;
        
        const title = document.getElementById('inheritanceGraphTitle');
        if (title) {
            title.textContent = `Inheritance Graph: ${nodeId}`;
        }
        
        if (this.network && this.network.body && this.network.body.data) {
            const nodeDataSet = this.network.body.data.nodes;
            if (nodeDataSet) {
                const updates = this.allNodes.map(node => {
                    const isMember = node.type === 'member';
                    const isCurrent = node.id === nodeId;
                    
                    return {
                        id: node.id,
                        color: {
                            background: isCurrent ? '#2d2d2d' : '#2d2d2d',
                            border: isCurrent ? '#4a9eff' : (isMember ? '#6b7fd7' : '#3a3a3a'),
                            highlight: {
                                background: isCurrent ? '#3a3a3a' : '#3a3a3a',
                                border: isCurrent ? '#5ba8ff' : (isMember ? '#8b7fd7' : '#4a9eff')
                            }
                        },
                        hidden: false,
                        opacity: 1.0
                    };
                });
                
                nodeDataSet.update(updates);
            }
        }
        
        setTimeout(() => {
            if (this.network) {
                this.network.focus(nodeId, {
                    scale: 1.5,
                    animation: {
                        duration: 500,
                        easingFunction: 'easeInOutQuad'
                    }
                });
                
                setTimeout(() => {
                    if (this.network) {
                        this.network.redraw();
                    }
                }, 100);
            }
        }, 50);
    }

    focusOnNode(nodeId) {
            if (this.network && this.historyIndex >= 0 && this.history[this.historyIndex]) {
                this.saveViewState();
            }
            
            const classItem = window.app.indexes.classes.get(nodeId);
            const structItem = window.app.indexes.structs.get(nodeId);
            const item = classItem || structItem;

            if (item) {
                const itemName = item.name || item.className || 'Unknown';
                const historyEntry = { 
                    item: item, 
                    mode: this.currentMode, 
                    name: itemName,
                    viewState: null
                };
                
                if (this.historyIndex < this.history.length - 1) {
                    this.history = this.history.slice(0, this.historyIndex + 1);
                }
                
                this.history.push(historyEntry);
                this.historyIndex = this.history.length - 1;
                this.updateNavigationButtons();
                
                this.currentItem = item;
                const title = document.getElementById('inheritanceGraphTitle');
                if (title) {
                    title.textContent = `Inheritance Graph: ${itemName}`;
                }

                const container = document.getElementById('inheritanceGraphContainer');
                if (container && this.network) {
                    container.innerHTML = '<div class="graph-loading"><div class="graph-loading-spinner"></div><div class="graph-loading-text">Updating graph...</div></div>';
                }

                setTimeout(() => {
                    this.buildGraphAsync().then(() => {
                        this.renderGraph(null);
                    });
                }, 50);
            }
        }

        navigateHistory(direction) {
            if (this.network && this.historyIndex >= 0 && this.history[this.historyIndex]) {
                this.saveViewState();
            }
            
            const newIndex = this.historyIndex + direction;
            if (newIndex >= 0 && newIndex < this.history.length) {
                this.historyIndex = newIndex;
                const historyEntry = this.history[newIndex];
                this.currentItem = historyEntry.item;
                this.currentMode = historyEntry.mode;
                
                const title = document.getElementById('inheritanceGraphTitle');
                if (title) {
                    title.textContent = `Inheritance Graph: ${historyEntry.name}`;
                }
                
                const showParentsCheck = document.getElementById('graphShowParents');
                const showChildrenCheck = document.getElementById('graphShowChildren');
                if (historyEntry.mode === 'parents') {
                    if (showParentsCheck) showParentsCheck.checked = true;
                    if (showChildrenCheck) showChildrenCheck.checked = false;
                } else if (historyEntry.mode === 'children') {
                    if (showParentsCheck) showParentsCheck.checked = false;
                    if (showChildrenCheck) showChildrenCheck.checked = true;
                } else {
                    if (showParentsCheck) showParentsCheck.checked = true;
                    if (showChildrenCheck) showChildrenCheck.checked = true;
                }
                
                this.updateNavigationButtons();
                
                const container = document.getElementById('inheritanceGraphContainer');
                if (container) {
                    container.innerHTML = '<div class="graph-loading"><div class="graph-loading-spinner"></div><div class="graph-loading-text">Loading...</div></div>';
                }
                
                this.network = null;
                
                const savedViewState = historyEntry.viewState;
                
                setTimeout(() => {
                    this.buildGraphAsync().then(() => {
                        this.renderGraph(savedViewState);
                    });
                }, 50);
            }
        }

        saveViewState() {
            if (this.network && this.historyIndex >= 0 && this.history[this.historyIndex]) {
                try {
                    const view = this.network.getViewPosition();
                    const scale = this.network.getScale();
                    this.history[this.historyIndex].viewState = {
                        position: view,
                        scale: scale
                    };
                } catch (e) {
                }
            }
        }

        restoreViewState(viewState) {
            if (this.network && viewState) {
                try {
                    this.network.moveTo({
                        position: viewState.position,
                        scale: viewState.scale,
                        animation: {
                            duration: 300,
                            easingFunction: 'easeInOutQuad'
                        }
                    });
                } catch (e) {
                }
            }
        }

        updateNavigationButtons() {
            const navBackBtn = document.getElementById('graphNavBack');
            const navForwardBtn = document.getElementById('graphNavForward');
            
            if (navBackBtn) {
                navBackBtn.disabled = this.historyIndex <= 0;
            }
            if (navForwardBtn) {
                navForwardBtn.disabled = this.historyIndex >= this.history.length - 1;
            }
        }

    navigateToNode(nodeId) {
        const classItem = window.app.indexes.classes.get(nodeId);
        const structItem = window.app.indexes.structs.get(nodeId);
        const item = classItem || structItem;

        if (item && window.app) {
            this.close();
            window.app.showDetail(item);
        }
    }

    resetZoom() {
        if (this.network) {
            this.network.moveTo({ scale: 1, position: { x: 0, y: 0 } });
        }
    }

    fitToScreen() {
        if (this.network) {
            this.network.fit();
        }
    }

    updateInfo() {
        const info = document.getElementById('inheritanceGraphInfo');
        if (info) {
            const nodeCount = this.filteredNodes.length;
            const edgeCount = this.filteredEdges.length;
            info.textContent = `Nodes: ${nodeCount} | Edges: ${edgeCount}`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.inheritanceGraph = new InheritanceGraph();
});

