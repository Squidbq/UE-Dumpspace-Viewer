class CollectionStorage {
    constructor() {
        this.storageKey = 'dumpspace_collections';
        this.backupKey = 'dumpspace_collections_backup';
    }

    generateId() {
        return 'col_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async saveCollection(collection) {
        if (!collection.id) {
            collection.id = this.generateId();
        }
        if (!collection.createdAt) {
            collection.createdAt = new Date().toISOString();
        }
        collection.updatedAt = new Date().toISOString();

        const collections = await this.loadCollections();
        const index = collections.findIndex(c => c.id === collection.id);
        
        if (index >= 0) {
            collections[index] = collection;
        } else {
            collections.push(collection);
        }

        await this.createBackup(collections);
        
        if (window.electronAPI && window.electronAPI.saveCollections) {
            try {
                const result = await window.electronAPI.saveCollections(collections);
                if (result.success) {
                    return { success: true, collection: collection };
                } else {
                    throw new Error(result.error || 'Failed to save collections');
                }
            } catch (error) {
                console.error('Failed to save collection to file:', error);
                return { success: false, error: error.message };
            }
        } else {
            try {
                localStorage.setItem(this.storageKey, JSON.stringify(collections));
                return { success: true, collection: collection };
            } catch (error) {
                console.error('Failed to save collection:', error);
                return { success: false, error: error.message };
            }
        }
    }

    async loadCollections() {
        if (window.electronAPI && window.electronAPI.loadCollections) {
            try {
                const result = await window.electronAPI.loadCollections();
                if (result.success) {
                    return result.data || [];
                } else {
                    console.error('Failed to load collections from file:', result.error);
                    return [];
                }
            } catch (error) {
                console.error('Failed to load collections:', error);
                return [];
            }
        } else {
            try {
                const data = localStorage.getItem(this.storageKey);
                if (!data) {
                    return [];
                }
                return JSON.parse(data);
            } catch (error) {
                console.error('Failed to load collections:', error);
                return [];
            }
        }
    }

    async getCollectionsByGame(gameName, gameVersion = null) {
        const collections = await this.loadCollections();
        return collections.filter(c => {
            if (gameVersion) {
                return c.gameName === gameName && c.gameVersion === gameVersion;
            }
            return c.gameName === gameName;
        });
    }

    async getCollectionById(id) {
        const collections = await this.loadCollections();
        return collections.find(c => c.id === id) || null;
    }

    async deleteCollection(collectionId) {
        const collections = await this.loadCollections();
        const filtered = collections.filter(c => c.id !== collectionId);
        
        if (window.electronAPI && window.electronAPI.saveCollections) {
            try {
                const result = await window.electronAPI.saveCollections(filtered);
                return result;
            } catch (error) {
                console.error('Failed to delete collection:', error);
                return { success: false, error: error.message };
            }
        } else {
            try {
                localStorage.setItem(this.storageKey, JSON.stringify(filtered));
                return { success: true };
            } catch (error) {
                console.error('Failed to delete collection:', error);
                return { success: false, error: error.message };
            }
        }
    }

    async updateCollection(collectionId, updates) {
        const collection = await this.getCollectionById(collectionId);
        if (!collection) {
            return { success: false, error: 'Collection not found' };
        }

        Object.assign(collection, updates);
        return await this.saveCollection(collection);
    }

    async exportCollection(collectionId) {
        const collection = await this.getCollectionById(collectionId);
        if (!collection) {
            return null;
        }
        const cleanCollection = { ...collection };
        delete cleanCollection.folderPath;
        
        if (cleanCollection.members && Array.isArray(cleanCollection.members)) {
            cleanCollection.members = cleanCollection.members.map(member => {
                const cleanMember = { ...member };
                delete cleanMember.absoluteOffset;
                delete cleanMember.fromClass;
                delete cleanMember.addedAt;
                return cleanMember;
            });
        }
        
        if (cleanCollection.classes && Array.isArray(cleanCollection.classes)) {
            cleanCollection.classes = cleanCollection.classes.map(classInfo => {
                const cleanClass = { ...classInfo };
                delete cleanClass.namespace;
                return cleanClass;
            });
        }
        
        delete cleanCollection.dumpTimestamp;
        delete cleanCollection.description;
        
        return JSON.stringify(cleanCollection, null, 2);
    }

    async importCollection(jsonData) {
        try {
            const collection = JSON.parse(jsonData);
            if (!collection.gameName || !collection.collectionName) {
                return { success: false, error: 'Invalid collection format' };
            }
            
            delete collection.folderPath;
            
            if (collection.members && Array.isArray(collection.members)) {
                collection.members = collection.members.map(member => {
                    const cleanMember = { ...member };
                    delete cleanMember.absoluteOffset;
                    delete cleanMember.fromClass;
                    delete cleanMember.addedAt;
                    return cleanMember;
                });
            }
            
            if (collection.classes && Array.isArray(collection.classes)) {
                collection.classes = collection.classes.map(classInfo => {
                    const cleanClass = { ...classInfo };
                    delete cleanClass.namespace;
                    return cleanClass;
                });
            }
            
            delete collection.dumpTimestamp;
            delete collection.description;
            
            collection.id = this.generateId();
            collection.createdAt = new Date().toISOString();
            collection.updatedAt = new Date().toISOString();
            
            return await this.saveCollection(collection);
        } catch (error) {
            console.error('Failed to import collection:', error);
            return { success: false, error: error.message };
        }
    }

    checkConflicts(collection) {
        if (!window.app || !window.app.indexes) {
            return { conflicts: [], hasConflicts: false };
        }

        const conflicts = [];
        
        for (const member of collection.members || []) {
            const className = member.className;
            const memberName = member.memberName;
            
            const classItem = window.app.indexes.classes.get(className) || 
                           window.app.indexes.structs.get(className);
            
            if (!classItem) {
                conflicts.push({
                    type: 'class_missing',
                    member: member,
                    message: `Class ${className} no longer exists`
                });
                continue;
            }
            
            let memberFound = false;
            let currentMember = null;
            
            if (classItem.data && Array.isArray(classItem.data)) {
                for (const item of classItem.data) {
                    if (typeof item === 'object' && item !== null) {
                        const entries = Object.entries(item);
                        for (const [name, data] of entries) {
                            if (name === memberName && Array.isArray(data) && data.length >= 2) {
                                memberFound = true;
                                const currentOffset = data[1];
                                const currentType = data[0];
                                
                                const offsetDiff = Math.abs(currentOffset - member.offset);
                                const offsetPercent = (offsetDiff / Math.max(member.offset, 1)) * 100;
                                
                                if (offsetPercent > 20 && offsetDiff > 16) {
                                    conflicts.push({
                                        type: 'offset_changed',
                                        member: member,
                                        currentOffset: currentOffset,
                                        message: `Offset changed: 0x${member.offset.toString(16)} → 0x${currentOffset.toString(16)}`
                                    });
                                }
                                
                                let typeStr = 'Unknown';
                                if (Array.isArray(currentType) && currentType.length > 0) {
                                    typeStr = window.inheritanceViewer ? window.inheritanceViewer.formatType(currentType) : String(currentType);
                                }
                                
                                const normalizedCurrent = typeStr.replace(/\s+/g, '').toLowerCase();
                                const normalizedStored = (member.memberType || '').replace(/\s+/g, '').toLowerCase();
                                
                                if (normalizedCurrent !== normalizedStored && 
                                    !normalizedCurrent.includes(normalizedStored) && 
                                    !normalizedStored.includes(normalizedCurrent) &&
                                    normalizedStored !== 'unknown' && normalizedStored !== 'unknowntype') {
                                    conflicts.push({
                                        type: 'type_changed',
                                        member: member,
                                        currentType: typeStr,
                                        message: `Type changed: ${member.memberType} → ${typeStr}`
                                    });
                                }
                                
                                currentMember = { offset: currentOffset, type: typeStr };
                                break;
                            }
                        }
                    }
                    if (memberFound) break;
                }
            }
            
            if (!memberFound) {
                conflicts.push({
                    type: 'member_missing',
                    member: member,
                    message: `Member ${memberName} no longer exists in ${className}`
                });
            }
        }
        
        return {
            conflicts: conflicts,
            hasConflicts: conflicts.length > 0
        };
    }

    async createBackup(collections) {
        if (window.electronAPI && window.electronAPI.saveCollections) {
            return;
        }
        
        try {
            const backups = JSON.parse(localStorage.getItem(this.backupKey) || '[]');
            backups.push({
                timestamp: new Date().toISOString(),
                data: collections
            });
            
            if (backups.length > 5) {
                backups.shift();
            }
            
            localStorage.setItem(this.backupKey, JSON.stringify(backups));
        } catch (error) {
            console.error('Failed to create backup:', error);
        }
    }

    async getAllGames() {
        const collections = await this.loadCollections();
        const games = new Map();
        
        collections.forEach(c => {
            const key = `${c.gameName}::${c.gameVersion}`;
            if (!games.has(key)) {
                games.set(key, {
                    gameName: c.gameName,
                    gameVersion: c.gameVersion,
                    collectionCount: 0
                });
            }
            games.get(key).collectionCount++;
        });
        
        return Array.from(games.values());
    }
}

window.collectionStorage = new CollectionStorage();

