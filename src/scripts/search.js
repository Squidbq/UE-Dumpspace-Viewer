class SearchEngine {
    constructor() {
        this.lastResults = [];
        this.searchTimeout = null;
        this.globalSearchTimeout = null;
        this.isSearching = false;
        this.maxResults = 1000;
    }

    performSearch(query) {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        this.showSearchLoading();

        this.searchTimeout = setTimeout(() => {
            this.executeSearch(query);
        }, 300);
    }

    async executeSearch(query) {
        if (!window.app || !window.app.data.classes) {
            return;
        }

        if (this.isSearching) {
            return;
        }

        this.isSearching = true;

        const filters = {
            classes: document.getElementById('filterClasses')?.checked ?? true,
            structs: document.getElementById('filterStructs')?.checked ?? true,
            functions: document.getElementById('filterFunctions')?.checked ?? true,
            enums: document.getElementById('filterEnums')?.checked ?? true,
            offsets: document.getElementById('filterOffsets')?.checked ?? true
        };

        const typeSearchMode = document.getElementById('typeSearchMode')?.checked ?? false;
        const includeFunctionParams = document.getElementById('includeFunctionParams')?.checked ?? true;

        const results = [];
        const lowerQuery = query.toLowerCase();

        this.searchInChunks(filters, lowerQuery, typeSearchMode, includeFunctionParams, results);

        this.lastResults = results;
        this.displayResults(results, query);
        this.isSearching = false;
        this.hideSearchLoading();
    }

    async searchInChunks(filters, lowerQuery, typeSearchMode, includeFunctionParams, results) {
        if (!window.app || !window.app.searchIndexes) {
            console.warn('Search indexes not ready');
            const resultsContainer = document.getElementById('globalSearchResults');
            if (resultsContainer) {
                const loadingDiv = resultsContainer.querySelector('.global-search-loading');
                if (loadingDiv) loadingDiv.remove();
                resultsContainer.innerHTML = '<div class="empty-state-main"><p>Search indexes not ready. Please wait...</p></div>';
            }
            return;
        }
        
        const searchIndexes = window.app.searchIndexes;
        const resultSet = new Map();
        const queryLength = lowerQuery.length;

        if (queryLength >= 3) {
            const prefix = lowerQuery.substring(0, Math.min(6, queryLength));
            if (searchIndexes.nameIndex.has(prefix)) {
                searchIndexes.nameIndex.get(prefix).forEach(item => {
                    const itemType = item.type || item.searchType;
                    if (this.matchesFilter(itemType, filters)) {
                        const name = (item.name || item.funcName || item.className || '').toLowerCase();
                        if (name.includes(lowerQuery)) {
                            const matchReason = name === lowerQuery ? 'name' : 'name-partial';
                            if (!resultSet.has(item) || resultSet.get(item) === 'member' || resultSet.get(item) === 'member-type') {
                                resultSet.set(item, matchReason);
                            }
                        }
                    }
                });
            }
        }

        searchIndexes.nameIndex.forEach((items, term) => {
            const termMatches = (queryLength >= 3 && lowerQuery.startsWith(term)) || 
                               (term.length >= 3 && term.includes(lowerQuery));
            
            if (termMatches) {
                items.forEach(item => {
                    const itemType = item.type || item.searchType;
                    if (this.matchesFilter(itemType, filters)) {
                        const name = (item.name || item.funcName || item.className || '').toLowerCase();
                        
                        if (name.includes(lowerQuery)) {
                            const matchReason = name === lowerQuery ? 'name' : 'name-partial';
                            if (!resultSet.has(item) || resultSet.get(item) === 'member' || resultSet.get(item) === 'member-type') {
                                resultSet.set(item, matchReason);
                            }
                        } else {
                            const isInheritanceMatch = this.checkIfInheritanceMatch(item, lowerQuery);
                            if (isInheritanceMatch) {
                                if (!resultSet.has(item) || resultSet.get(item) === 'member' || resultSet.get(item) === 'member-type') {
                                    resultSet.set(item, 'inheritance');
                                }
                            }
                        }
                    }
                });
            }
        });

        const memberMatchInfo = new Map();
        if (!typeSearchMode) {
            searchIndexes.memberNameIndex.forEach((items, term) => {
                if (term.includes(lowerQuery)) {
                    items.forEach(item => {
                        const itemType = item.type || item.searchType;
                        if ((itemType === 'class' || itemType === 'classes' || itemType === 'struct' || itemType === 'structs') 
                            && this.matchesFilter(itemType, filters)) {
                            if (!resultSet.has(item) || resultSet.get(item) === 'member-type') {
                                resultSet.set(item, 'member');
                                
                                if (!memberMatchInfo.has(item) && item.data && Array.isArray(item.data)) {
                                    for (const member of item.data) {
                                        if (typeof member === 'object' && member !== null) {
                                            const entries = Object.entries(member);
                                            for (const [memberName, memberData] of entries) {
                                                if (memberName === '__InheritInfo' || memberName === '__MDKClassSize') {
                                                    continue;
                                                }
                                                const memberNameLower = memberName.toLowerCase();
                                                if (memberNameLower.includes(lowerQuery)) {
                                                    let memberType = '';
                                                    if (Array.isArray(memberData) && memberData.length > 0) {
                                                        const typeInfo = memberData[0];
                                                        if (Array.isArray(typeInfo) && typeInfo.length > 0) {
                                                            memberType = window.inheritanceViewer.formatType(typeInfo);
                                                        }
                                                    }
                                                    memberMatchInfo.set(item, { memberName: memberName, memberType: memberType });
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            });
        }

        const memberTypeMatchInfo = new Map();
        if (typeSearchMode) {
            searchIndexes.memberTypeIndex.forEach((items, term) => {
                if (term.includes(lowerQuery)) {
                    items.forEach(item => {
                        const itemType = item.type || item.searchType;
                        if ((itemType === 'class' || itemType === 'classes' || itemType === 'struct' || itemType === 'structs')
                            && this.matchesFilter(itemType, filters)) {
                            if (!resultSet.has(item)) {
                                resultSet.set(item, 'member-type');
                                
                                if (!memberTypeMatchInfo.has(item) && item.data && Array.isArray(item.data)) {
                                    for (const member of item.data) {
                                        if (typeof member === 'object' && member !== null) {
                                            const entries = Object.entries(member);
                                            for (const [memberName, memberData] of entries) {
                                                if (memberName === '__InheritInfo' || memberName === '__MDKClassSize') {
                                                    continue;
                                                }
                                                if (Array.isArray(memberData) && memberData.length > 0) {
                                                    const typeInfo = memberData[0];
                                                    if (Array.isArray(typeInfo) && typeInfo.length > 0) {
                                                        const typeStr = window.inheritanceViewer.formatType(typeInfo);
                                                        if (typeStr.toLowerCase().includes(lowerQuery)) {
                                                            memberTypeMatchInfo.set(item, { memberName: memberName, memberType: typeStr });
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            });
        }

        const paramMatchInfo = new Map();
        if (includeFunctionParams) {
            searchIndexes.functionParamIndex.forEach((items, term) => {
                if (term.includes(lowerQuery)) {
                    items.forEach(item => {
                        const itemType = item.type || item.searchType;
                        if (itemType === 'function' && filters.functions) {
                            if (!resultSet.has(item)) {
                                resultSet.set(item, 'param');
                                
                                if (item.data && Array.isArray(item.data) && item.data.length > 1) {
                                    const params = item.data[1];
                                    if (Array.isArray(params)) {
                                        for (const param of params) {
                                            if (Array.isArray(param) && param.length >= 3) {
                                                const paramType = param[0];
                                                const paramName = param[2] || '';
                                                
                                                let paramTypeStr = '';
                                                if (Array.isArray(paramType) && paramType.length > 0) {
                                                    paramTypeStr = window.inheritanceViewer.formatType(paramType);
                                                }
                                                
                                                const paramNameLower = paramName.toLowerCase();
                                                const paramTypeLower = paramTypeStr.toLowerCase();
                                                
                                                if (paramNameLower.includes(lowerQuery) || paramTypeLower.includes(lowerQuery)) {
                                                    paramMatchInfo.set(item, {
                                                        paramName: paramName,
                                                        paramType: paramTypeStr,
                                                        matchedType: paramTypeLower.includes(lowerQuery) ? 'type' : 'name'
                                                    });
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            });
        }

        resultSet.forEach((matchReason, item) => {
            const name = item.name || item.funcName || `${item.className}::${item.funcName}` || 'Unknown';
            
            let detectedType = item.type || item.searchType;
            if (!detectedType || detectedType === 'unknown') {
                if (window.app && window.app.indexes) {
                    if (window.app.indexes.classes && window.app.indexes.classes.has(item.name)) {
                        detectedType = 'class';
                    } else if (window.app.indexes.structs && window.app.indexes.structs.has(item.name)) {
                        detectedType = 'struct';
                    } else if (window.app.indexes.functions && window.app.indexes.functions.has(item.name)) {
                        detectedType = 'function';
                    } else if (window.app.indexes.enums && window.app.indexes.enums.has(item.name)) {
                        detectedType = 'enum';
                    } else if (window.app.indexes.offsets && window.app.indexes.offsets.has(item.name)) {
                        detectedType = 'offset';
                    } else {
                        if (item.funcName || item.className) {
                            detectedType = 'function';
                        } else if (item.value !== undefined) {
                            detectedType = 'offset';
                        } else if (item.data && Array.isArray(item.data)) {
                            const firstData = item.data[0];
                            if (Array.isArray(firstData) && firstData.length > 0) {
                                const firstEntry = firstData[0];
                                if (typeof firstEntry === 'object' && firstEntry !== null) {
                                    detectedType = 'enum';
                                }
                            }
                        }
                    }
                } else {
                    if (item.funcName || item.className) {
                        detectedType = 'function';
                    } else if (item.value !== undefined) {
                        detectedType = 'offset';
                    }
                }
            }
            
            if (detectedType === 'classes') detectedType = 'class';
            if (detectedType === 'structs') detectedType = 'struct';
            
            let validatedMatchReason = matchReason || 'unknown';
            
            if (validatedMatchReason === 'param' && detectedType !== 'function') {
                if (detectedType === 'class' || detectedType === 'struct') {
                    const itemName = (item.name || '').toLowerCase();
                    if (itemName === lowerQuery) {
                        validatedMatchReason = 'name';
                    } else if (itemName.includes(lowerQuery)) {
                        validatedMatchReason = 'name-partial';
                    } else {
                        validatedMatchReason = 'member';
                    }
                } else {
                    validatedMatchReason = 'name-partial';
                }
            }
            
            if ((validatedMatchReason === 'member' || validatedMatchReason === 'member-type') && 
                detectedType !== 'class' && detectedType !== 'struct') {
                const itemName = (item.name || item.funcName || item.className || '').toLowerCase();
                if (itemName === lowerQuery) {
                    validatedMatchReason = 'name';
                } else {
                    validatedMatchReason = 'name-partial';
                }
            }
            
            const resultItem = {
                ...item,
                matchText: name,
                searchType: detectedType || 'unknown',
                matchReason: validatedMatchReason
            };
            
            if (paramMatchInfo.has(item)) {
                resultItem.paramMatchInfo = paramMatchInfo.get(item);
            }
            
            if (memberMatchInfo.has(item)) {
                resultItem.memberMatchInfo = memberMatchInfo.get(item);
            }
            
            if (memberTypeMatchInfo.has(item)) {
                resultItem.memberTypeMatchInfo = memberTypeMatchInfo.get(item);
            }
            
            results.push(resultItem);
        });
    }

    matchesFilter(itemType, filters) {
        if (itemType === 'class' || itemType === 'classes') return filters.classes;
        if (itemType === 'struct' || itemType === 'structs') return filters.structs;
        if (itemType === 'function') return filters.functions;
        if (itemType === 'enum') return filters.enums;
        if (itemType === 'offset') return filters.offsets;
        return false;
    }

    checkIfInheritanceMatch(item, query) {
        if (!item.data || !Array.isArray(item.data)) {
            return false;
        }

        if (window.app && window.app.getFullInheritanceChainRecursive) {
            const inheritanceChain = window.app.getFullInheritanceChainRecursive(item);
            if (inheritanceChain && inheritanceChain.length > 0) {
                return inheritanceChain.some(className => 
                    className && className.toLowerCase().includes(query)
                );
            }
        }

        for (const member of item.data) {
            if (typeof member === 'object' && member !== null) {
                const entries = Object.entries(member);
                for (const [key, value] of entries) {
                    if (key === '__InheritInfo' && Array.isArray(value)) {
                        return value.some(className => 
                            className && typeof className === 'string' && className.toLowerCase().includes(query)
                        );
                    }
                }
            }
        }

        return false;
    }

    showSearchLoading() {
        const resultsPanel = document.getElementById('resultsPanel');
        const resultsList = document.getElementById('resultsList');
        if (resultsPanel && resultsList) {
            resultsPanel.style.display = 'flex';
            resultsList.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><p>Searching...</p></div>';
        }
    }

    hideSearchLoading() {
    }

    async searchInIndexAsync(indexKey, query, typeSearchMode, results) {
        const index = window.app.indexes[indexKey];
        if (!index) return;

        const items = Array.from(index.entries());
        const chunkSize = 100;

        for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            
            for (const [name, item] of chunk) {
                if (results.length >= this.maxResults) {
                    return;
                }

                let match = false;
                let matchText = '';

                if (name.toLowerCase().includes(query)) {
                    match = true;
                    matchText = name;
                } else {
                    if (typeSearchMode && item.data && Array.isArray(item.data)) {
                        for (const member of item.data) {
                            if (typeof member === 'object' && member !== null) {
                                const memberEntries = Object.entries(member);
                                for (const [memberName, memberData] of memberEntries) {
                                    if (memberName === '__InheritInfo' || memberName === '__MDKClassSize') {
                                        continue;
                                    }
                                    
                                    if (Array.isArray(memberData) && memberData.length > 0) {
                                        const typeInfo = memberData[0];
                                        if (Array.isArray(typeInfo) && typeInfo.length > 0) {
                                            const typeName = typeInfo[0];
                                            if (typeof typeName === 'string' && typeName.toLowerCase().includes(query)) {
                                                match = true;
                                                matchText = `${name} (member type: ${typeName})`;
                                                break;
                                            }
                                        }
                                    }
                                }
                                if (match) break;
                            }
                        }
                    } else if (!typeSearchMode && item.data && Array.isArray(item.data)) {
                        for (const member of item.data) {
                            if (typeof member === 'object' && member !== null) {
                                const memberEntries = Object.entries(member);
                                for (const [memberName] of memberEntries) {
                                    if (memberName === '__InheritInfo' || memberName === '__MDKClassSize') {
                                        continue;
                                    }
                                    if (memberName.toLowerCase().includes(query)) {
                                        match = true;
                                        matchText = `${name} (member: ${memberName})`;
                                        break;
                                    }
                                }
                                if (match) break;
                            }
                        }
                    }
                }

                if (match) {
                    results.push({
                        ...item,
                        matchText,
                        searchType: indexKey === 'classes' ? 'class' : indexKey === 'structs' ? 'struct' : 'enum'
                    });
                }
            }

            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    async searchFunctionsAsync(query, includeParams, results) {
        const index = window.app.indexes.functions;
        if (!index) return;

        const items = Array.from(index.entries());
        const chunkSize = 100;

        for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            
            for (const [key, item] of chunk) {
                if (results.length >= this.maxResults) {
                    return;
                }

                let match = false;
                let matchText = '';

                if (item.funcName && item.funcName.toLowerCase().includes(query)) {
                    match = true;
                    matchText = `${item.className}::${item.funcName}`;
                }

                if (!match && item.className && item.className.toLowerCase().includes(query)) {
                    match = true;
                    matchText = `${item.className}::${item.funcName}`;
                }

                if (!match && includeParams && item.data && Array.isArray(item.data)) {
                    const funcInfo = item.data[0];
                    if (Array.isArray(funcInfo) && funcInfo.length > 1) {
                        const params = funcInfo[1];
                        if (Array.isArray(params)) {
                            for (const param of params) {
                                if (Array.isArray(param) && param.length >= 3) {
                                    const paramType = param[0];
                                    const paramName = param[2];
                                    if (Array.isArray(paramType) && paramType.length > 0) {
                                        const typeName = paramType[0];
                                        if ((typeof typeName === 'string' && typeName.toLowerCase().includes(query)) ||
                                            (typeof paramName === 'string' && paramName.toLowerCase().includes(query))) {
                                            match = true;
                                            matchText = `${item.className}::${item.funcName} (param: ${paramName})`;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if (match) {
                    results.push({
                        ...item,
                        matchText,
                        searchType: 'function'
                    });
                }
            }

            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    async searchOffsetsAsync(query, results) {
        const index = window.app.indexes.offsets;
        if (!index) return;

        const items = Array.from(index.values());
        
        for (const item of items) {
            if (results.length >= this.maxResults) {
                return;
            }

            if (item.name && item.name.toLowerCase().includes(query)) {
                results.push({
                    ...item,
                    matchText: item.name,
                    searchType: 'offset'
                });
            }
        }
    }

    displayResults(results, query) {
        const resultsPanel = document.getElementById('resultsPanel');
        const resultsList = document.getElementById('resultsList');
        const resultsCount = document.getElementById('resultsCount');
        const emptyState = document.getElementById('emptyState');

        if (results.length === 0) {
            resultsPanel.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }

        resultsPanel.style.display = 'flex';
        emptyState.style.display = 'none';
        
        const totalResults = results.length;
        const hasMore = totalResults >= this.maxResults;
        resultsCount.textContent = hasMore 
            ? `${totalResults}+ results (showing first ${this.maxResults})`
            : `${totalResults} result${totalResults !== 1 ? 's' : ''}`;

        const fragment = document.createDocumentFragment();
        const displayResults = results.slice(0, this.maxResults);

        displayResults.forEach((item, index) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            resultItem.addEventListener('click', () => {
                window.app.showDetail(item);
            });

            const typeLabel = this.getTypeLabel(item.searchType);
            const highlightedText = this.highlightText(item.matchText, query);

            resultItem.innerHTML = `
                <div class="result-item-header">
                    <span class="result-item-name">${highlightedText}</span>
                    <span class="result-item-type">${typeLabel}</span>
                </div>
                ${this.getResultInfo(item)}
            `;

            fragment.appendChild(resultItem);
        });

        resultsList.innerHTML = '';
        resultsList.appendChild(fragment);
    }

    getTypeLabel(type) {
        const labels = {
            'class': 'Class',
            'struct': 'Struct',
            'function': 'Function',
            'enum': 'Enum',
            'offset': 'Offset'
        };
        return labels[type] || 'Unknown';
    }

    getResultInfo(item) {
        if (item.searchType === 'function') {
            return `<div class="result-item-info">Class: ${item.className}</div>`;
        } else if (item.searchType === 'offset') {
            return `<div class="result-item-info">Value: ${item.value}</div>`;
        } else if (item.data) {
            for (const member of item.data) {
                if (typeof member === 'object' && member !== null) {
                    const entries = Object.entries(member);
                    for (const [key, value] of entries) {
                        if (key === '__InheritInfo' && Array.isArray(value) && value.length > 0) {
                            return `<div class="result-item-info">Inherits: ${value.join(' → ')}</div>`;
                        }
                    }
                }
            }
        }
        return '';
    }

    highlightText(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    }

    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    performGlobalSearch(query) {
        if (!window.app || !window.app.data || !window.app.data.classes) {
            console.warn('App data not ready for global search');
            const resultsContainer = document.getElementById('globalSearchResults');
            if (resultsContainer) {
                const loadingDiv = resultsContainer.querySelector('.global-search-loading');
                if (loadingDiv) loadingDiv.remove();
                resultsContainer.innerHTML = '<div class="empty-state-main"><p>Data not loaded yet. Please wait...</p></div>';
            }
            return;
        }
        
        if (this.globalSearchTimeout) {
            clearTimeout(this.globalSearchTimeout);
        }

        this.globalSearchTimeout = setTimeout(() => {
            this.executeGlobalSearch(query);
        }, 300);
    }
    
    executeGlobalSearch(query) {
        if (!window.app || !window.app.data || !window.app.data.classes) {
            const resultsContainer = document.getElementById('globalSearchResults');
            if (resultsContainer) {
                const loadingDiv = resultsContainer.querySelector('.global-search-loading');
                if (loadingDiv) loadingDiv.remove();
                resultsContainer.innerHTML = '<div class="empty-state-main"><p>Data not loaded yet. Please wait...</p></div>';
            }
            return;
        }

        const filters = {
            classes: document.getElementById('gFilterClasses')?.checked ?? true,
            structs: document.getElementById('gFilterStructs')?.checked ?? true,
            functions: document.getElementById('gFilterFunctions')?.checked ?? true,
            enums: document.getElementById('gFilterEnums')?.checked ?? true,
            offsets: false
        };

        const typeSearchMode = document.getElementById('gTypeSearchMode')?.checked ?? false;
        const includeFunctionParams = document.getElementById('gIncludeFunctionParams')?.checked ?? true;

        const results = [];
        const lowerQuery = query.toLowerCase();

        this.searchInChunks(filters, lowerQuery, typeSearchMode, includeFunctionParams, results);
        
        requestAnimationFrame(() => {
            this.displayGlobalSearchResults(results, query);
        });
    }

    displayGlobalSearchResults(results, query) {
        const resultsContainer = document.getElementById('globalSearchResults');
        if (!resultsContainer) return;
        
        const loadingIndicator = resultsContainer.querySelector('.global-search-loading');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        
        if (resultsContainer._globalSearchClickHandler) {
            resultsContainer.removeEventListener('click', resultsContainer._globalSearchClickHandler);
            resultsContainer._globalSearchClickHandler = null;
        }
        
        if (results.length === 0) {
            const currentEmpty = resultsContainer.querySelector('.empty-state-main');
            if (!currentEmpty) {
                resultsContainer.innerHTML = '<div class="empty-state-main"><p>No results found</p></div>';
            }
            return;
        }

        const groupedResults = {};
        results.forEach(item => {
            let type = item.searchType || item.type || 'unknown';
            if (type === 'classes') type = 'class';
            if (type === 'structs') type = 'struct';
            if (type === 'functions') type = 'function';
            if (type === 'enums') type = 'enum';
            if (type === 'offsets') type = 'offset';
            
            if (!groupedResults[type]) {
                groupedResults[type] = [];
            }
            groupedResults[type].push(item);
        });
        
        const lowerQuery = query.toLowerCase();
        const getMatchPriority = (item) => {
            const matchReason = item.matchReason || 'unknown';
            const name = (item.name || item.funcName || item.className || '').toLowerCase();
            
            if (name === lowerQuery) return 1;
            
            if (name.startsWith(lowerQuery)) return 2;
            
            if (matchReason === 'name') return 3;
            
            if (name.includes(lowerQuery)) return 4;
            
            if (matchReason === 'name-partial') return 5;
            
            if (matchReason === 'member') return 6;
            
            if (matchReason === 'member-type') return 7;
            
            if (matchReason === 'param') return 8;
            
            if (matchReason === 'inheritance') return 9;
            
            return 10;
        };
        
        Object.keys(groupedResults).forEach(type => {
            groupedResults[type].sort((a, b) => {
                const priorityA = getMatchPriority(a);
                const priorityB = getMatchPriority(b);
                
                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }
                
                const nameA = (a.name || a.funcName || a.className || '').toLowerCase();
                const nameB = (b.name || b.funcName || b.className || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
        });

        let html = '';
        let globalItemIndex = 0;
        const allItems = [];
        
        Object.entries(groupedResults).forEach(([type, items]) => {
            const typeLabel = this.getTypeLabel(type);
            const typeIcon = this.getTypeIcon(type);
            
            html += `<div class="global-search-type-group">`;
            html += `<div class="global-search-type-header">`;
            html += `<span class="global-search-type-icon">${typeIcon}</span>`;
            html += `<span class="global-search-type-label">${typeLabel}</span>`;
            html += `<span class="global-search-type-count">${items.length}</span>`;
            html += `</div>`;

            items.slice(0, this.maxResults).forEach(item => {
                allItems.push(item);
                const itemIndex = globalItemIndex++;
                const name = item.name || item.funcName || `${item.className}::${item.funcName}` || 'Unknown';
                const highlightedText = this.highlightText(name, query);
                
                const matchReason = item.matchReason || 'unknown';
                const matchBadgeClass = this.getMatchBadgeClass(matchReason, type);
                const matchBadgeLabel = this.getMatchBadgeLabel(matchReason, type);
                
                let contextInfo = '';
                let extraInfo = '';
                
                if (type === 'function') {
                    if (matchReason === 'param' && item.paramMatchInfo) {
                        const paramInfo = item.paramMatchInfo;
                        const funcName = item.funcName || item.name || 'Unknown';
                        if (paramInfo.matchedType === 'type') {
                            contextInfo = `<span class="global-search-context">param type <span class="global-search-highlight">${this.escapeHtml(paramInfo.paramType)}</span> in <span class="global-search-function-name">${this.escapeHtml(funcName)}()</span>`;
                        } else {
                            contextInfo = `<span class="global-search-context">param <span class="global-search-highlight">${this.escapeHtml(paramInfo.paramName)}</span> in <span class="global-search-function-name">${this.escapeHtml(funcName)}()</span>`;
                        }
                        if (item.className) {
                            contextInfo += ` in <span class="global-search-class-link" data-type="${this.escapeHtml(item.className)}">${this.escapeHtml(item.className)}</span>`;
                        }
                        contextInfo += `</span>`;
                    } else {
                        if (item.className) {
                            contextInfo = `<span class="global-search-context">in <span class="global-search-class-link" data-type="${this.escapeHtml(item.className)}">${this.escapeHtml(item.className)}</span></span>`;
                        }
                    }
                    if (item.data && Array.isArray(item.data) && item.data.length > 0) {
                        const funcInfo = item.data[0];
                        if (Array.isArray(funcInfo) && funcInfo.length > 2) {
                            const offset = funcInfo[2];
                            if (typeof offset === 'number' && !isNaN(offset)) {
                                extraInfo = `<span class="global-search-offset">0x${offset.toString(16)}</span>`;
                            }
                        }
                    }
                } else if (type === 'class' || type === 'struct') {
                    const className = item.name || item.className || 'Unknown';
                    let matchDetails = '';
                    let inheritancePath = '';
                    
                    if (matchReason === 'member' && item.memberMatchInfo) {
                        const memberInfo = item.memberMatchInfo;
                        if (memberInfo.memberName) {
                            if (memberInfo.memberType) {
                                matchDetails = `member <span class="global-search-highlight">${this.escapeHtml(memberInfo.memberName)}</span> (<span class="global-search-highlight">${this.escapeHtml(memberInfo.memberType)}</span>)`;
                            } else {
                                matchDetails = `member <span class="global-search-highlight">${this.escapeHtml(memberInfo.memberName)}</span>`;
                            }
                        }
                    } else if (matchReason === 'member-type' && item.memberTypeMatchInfo) {
                        const memberTypeInfo = item.memberTypeMatchInfo;
                        if (memberTypeInfo.memberType) {
                            if (memberTypeInfo.memberName) {
                                matchDetails = `member <span class="global-search-highlight">${this.escapeHtml(memberTypeInfo.memberName)}</span> of type <span class="global-search-highlight">${this.escapeHtml(memberTypeInfo.memberType)}</span>`;
                            } else {
                                matchDetails = `member type <span class="global-search-highlight">${this.escapeHtml(memberTypeInfo.memberType)}</span>`;
                            }
                        }
                    }
                    
                    if (window.app && window.inheritanceViewer) {
                        try {
                            const inheritInfo = window.inheritanceViewer.getInheritanceInfo(item);
                            if (inheritInfo && inheritInfo.length > 0) {
                                const chain = [...inheritInfo];
                                chain.push(className);
                                
                                const displayChain = chain.slice(0, 3);
                                const remaining = chain.length - 3;
                                
                                inheritancePath = displayChain.map((parentName, idx) => {
                                    return `<span class="global-search-class-link" data-type="${this.escapeHtml(parentName)}">${this.escapeHtml(parentName)}</span>`;
                                }).join(' <span class="global-search-inheritance-arrow">→</span> ');
                                
                                if (remaining > 0) {
                                    inheritancePath += ` <span class="global-search-inheritance-more">+${remaining} more</span>`;
                                }
                                
                                inheritancePath = `<span class="global-search-inheritance-path">extends ${inheritancePath}</span>`;
                            }
                        } catch (e) {
                            if (item.data && Array.isArray(item.data)) {
                                for (const member of item.data) {
                                    if (typeof member === 'object' && member !== null) {
                                        const entries = Object.entries(member);
                                        for (const [memberName, memberData] of entries) {
                                            if (memberName === '__InheritInfo' && Array.isArray(memberData) && memberData.length > 0) {
                                                const parentNames = memberData.slice(0, 2).map(p => {
                                                    return `<span class="global-search-class-link" data-type="${this.escapeHtml(p)}">${this.escapeHtml(p)}</span>`;
                                                }).join(', ');
                                                if (memberData.length > 2) {
                                                    inheritancePath = `<span class="global-search-inheritance-path">extends ${parentNames} +${memberData.length - 2} more</span>`;
                                                } else {
                                                    inheritancePath = `<span class="global-search-inheritance-path">extends ${parentNames}</span>`;
                                                }
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    if (matchDetails && inheritancePath) {
                        contextInfo = `<span class="global-search-context">${matchDetails} • ${inheritancePath}</span>`;
                    } else if (matchDetails) {
                        contextInfo = `<span class="global-search-context">${matchDetails}</span>`;
                    } else if (inheritancePath) {
                        contextInfo = `<span class="global-search-context">${inheritancePath}</span>`;
                    }
                } else if (type === 'offset') {
                    const offsetHex = '0x' + item.value.toString(16);
                    extraInfo = `<span class="global-search-offset">${offsetHex}</span>`;
                }
                
                html += `<div class="global-search-result-item" data-item-type="${type}" data-item-index="${itemIndex}" title="Click to navigate">`;
                html += `<div class="global-search-result-content">`;
                html += `<div class="global-search-result-main">`;
                html += `<span class="global-search-result-badge ${matchBadgeClass}">${matchBadgeLabel}</span>`;
                html += `<span class="global-search-result-name">${highlightedText}</span>`;
                if (extraInfo) {
                    html += extraInfo;
                }
                html += `</div>`;
                if (contextInfo) {
                    html += `<div class="global-search-result-context">${contextInfo}</div>`;
                }
                html += `</div>`;
                if (type === 'offset') {
                    html += `<button class="global-search-copy-btn" title="Copy offset">`;
                    html += `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">`;
                    html += `<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>`;
                    html += `<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>`;
                    html += `</svg>`;
                    html += `</button>`;
                }
                html += `</div>`;
            });
            
            html += `</div>`;
        });

        requestAnimationFrame(() => {
            resultsContainer.innerHTML = html;

            if (resultsContainer._globalSearchClickHandler) {
                resultsContainer.removeEventListener('click', resultsContainer._globalSearchClickHandler);
            }
            
            resultsContainer._globalSearchClickHandler = (e) => {
                const classLink = e.target.closest('.global-search-class-link');
                if (classLink) {
                    e.preventDefault();
                    e.stopPropagation();
                    const typeName = classLink.getAttribute('data-type');
                    if (typeName) {
                        window.app.closeGlobalSearch();
                        window.app.navigateToType(typeName);
                    }
                    return;
                }
                
                const copyBtn = e.target.closest('.global-search-copy-btn');
                if (copyBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const resultItem = copyBtn.closest('.global-search-result-item');
                    const offsetSpan = resultItem?.querySelector('.global-search-offset');
                    if (offsetSpan) {
                        const offsetText = offsetSpan.textContent.trim();
                        if (offsetText && window.app) {
                            window.app.copyOffsetWithAnimation(copyBtn, offsetText);
                        }
                    }
                    return;
                }
                
                const resultItem = e.target.closest('.global-search-result-item');
                if (resultItem) {
                    if (e.target.closest('.global-search-class-link') || e.target.closest('.global-search-copy-btn')) {
                        return;
                    }
                    
                    const itemType = resultItem.getAttribute('data-item-type');
                    const itemIndex = parseInt(resultItem.getAttribute('data-item-index'), 10);
                    const originalItem = allItems[itemIndex];
                    
                    if (!originalItem) return;
                    
                    window.app.closeGlobalSearch();
                    const searchQuery = query.toLowerCase();
                    
                    let targetCategory = 'classes';
                    if (itemType === 'function') {
                        targetCategory = 'functions';
                    } else if (itemType === 'enum') {
                        targetCategory = 'enums';
                    } else if (itemType === 'offset') {
                        targetCategory = 'offsets';
                    } else if (itemType === 'struct') {
                        targetCategory = 'structs';
                    }
                    
                    if (window.app.currentCategory !== targetCategory) {
                        window.app.switchCategory(targetCategory, originalItem);
                        setTimeout(() => {
                            window.app.showDetail(originalItem, searchQuery);
                        }, 150);
                    } else {
                        setTimeout(() => {
                            window.app.showDetail(originalItem, searchQuery);
                        }, 50);
                    }
                }
            };
            
            resultsContainer.addEventListener('click', resultsContainer._globalSearchClickHandler);
        });
    }
    
    getTypeIcon(type) {
        const icons = {
            'class': '📦',
            'struct': '📋',
            'function': '⚙️',
            'enum': '🔢',
            'offset': '📍'
        };
        return icons[type] || '📄';
    }
    
    getMatchBadgeClass(matchReason, itemType) {
        if (itemType === 'function' && matchReason === 'param') {
            return 'match-param';
        }
        if (itemType === 'function' && matchReason !== 'param') {
            return 'match-function';
        }
        
        const classes = {
            'inheritance': 'match-inheritance',
            'member': 'match-member',
            'member-type': 'match-member-type',
            'param': 'match-param',
            'name-partial': 'match-name-partial',
            'name': 'match-name'
        };
        return classes[matchReason] || 'match-default';
    }
    
    getMatchBadgeLabel(matchReason, itemType) {
        if (itemType === 'function' && matchReason === 'param') {
            return 'Param';
        }
        if (itemType === 'function') {
            return 'Function';
        }
        
        const labels = {
            'inheritance': 'Inherits',
            'member': 'Member',
            'member-type': 'Type',
            'param': 'Param',
            'name-partial': 'Partial',
            'name': 'Exact'
        };
        return labels[matchReason] || 'Match';
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.searchEngine = new SearchEngine();

