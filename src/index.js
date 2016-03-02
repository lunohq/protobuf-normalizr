import Immutable from 'immutable';

function isProtobuf(obj) {
    return obj && obj.$type;
}

function isEntity(obj, key = null) {
    if (
        (obj && obj.hasOwnProperty('id') && obj.id !== null) ||
        (key !== null)
    ) {
        return true;

    }
    return false;
}

function hasEntityTypeInNormalizations(entityType, state) {
    if (Immutable.Map.isMap(state)) {
        return state.hasIn(['normalizations', entityType]);
    } else if (state) {
        return state.normalizations && !!state.normalizations[entityType];
    }
}

function hasEntityTypeInEntities(entityType, state) {
    if (Immutable.Map.isMap(state)) {
        return state.hasIn(['entities', entityType]);
    } else if (state) {
        return state.entities && !!state.entities[entityType];
    }
}

function getEntityFromState(entityType, key, state) {
    if (Immutable.Map.isMap(state)) {
        return state.getIn(['entities', entityType, key]);
    } else if (state) {
        return state.entities[entityType][key];
    }
}

function getNormalizationsFromState(entityType, key, state) {
    if (Immutable.Map.isMap(state)) {
        return state.getIn(['normalizations', entityType, key]);
    } else if (state) {
        return state.normalizations[entityType][key];
    }
}

function iterKeys(any) {
    if (Immutable.Iterable.isIterable(any)) {
        return any.keys();
    } else if (any) {
        return Object.keys(any);
    } else {
        return [];
    }
}

function iterValues(any) {
    if (Immutable.Iterable.isIterable(any)) {
        return any.values();
    } else if (any) {
        return Object.values(any);
    } else {
        return [];
    }
}

function getEntityKey(entity) {
    return entity.$type.fqn().toLowerCase();
}

function getEntityId(entity, key = null) {
    return key ? key : entity.get('id');
}

function get(any, field) {
    if (Immutable.Map.isMap(any)) {
        return any.get(field);
    } else {
        return any[field];
    }
}

function normalizeField(field, entity, entities, normalizations, key = null) {
    let value = entity.get(field.name)
    if (value === null || !(field.repeated && value.length && isEntity(value[0], key) || isEntity(value, key))) {
        return;
    }

    let entityKey = getEntityKey(entity);
    let entityId = getEntityId(entity, key);
    if (!normalizations[entityKey]) {
        normalizations[entityKey] = {};
    }

    if (!normalizations[entityKey][entityId]) {
        normalizations[entityKey][entityId] = {};
    }

    let stored = normalizations[entityKey][entityId];
    if (field.repeated) {
        if (!stored[field.name]) {
            stored[field.name] = [];
        }
        value.map((childProtobuf) => {
            stored[field.name].push(childProtobuf.id);
            visit(childProtobuf, entities, normalizations);
        })
        entity.set(field.name, null);
    } else if (isEntity(value)) {
        stored[field.name] = value.id;
        visit(value, entities, normalizations);
        entity.set(field.name, null);
    }
}

function visitProtobuf(entity, entities, normalizations, key = null) {
    entity.$type._fields.map((field) => {
        normalizeField(field, entity, entities, normalizations, key);
    });
    return entity;
}

function visitArray(obj, entities, normalizations) {
    const normalized = obj.map((childObj) => {
        return visit(childObj, entities, normalizations);
    })
    return normalized;
}

function visitEntity(entity, entities, normalizations, key = null) {
    const entityKey = getEntityKey(entity);
    const entityId = getEntityId(entity, key);

    if (!entities[entityKey]) {
        entities[entityKey] = {};
    }

    entities[entityKey][entityId] = entity;
    visitProtobuf(entity, entities, normalizations, key);
    return entityId;
}

function visit(obj, entities, normalizations, key = null) {
    if (isProtobuf(obj) && isEntity(obj, key)) {
        return visitEntity(obj, entities, normalizations, key);
    } else if (isProtobuf(obj)) {
        return visitProtobuf(obj, entities, normalizations);
    } else if (obj instanceof Array) {
        return visitArray(obj, entities, normalizations);
    }

    return obj;
}

function denormalizeEntity(entity, entityKey, key, state, parent = null, validator = null) {
    // Create a copy of the entity which we'll denormalize. This ensures we're not inflating entities when
    // denormalizing.
    const denormalizedEntity = entity.$type.clazz.decode(entity.encode());
    if (hasEntityTypeInNormalizations(entityKey, state)) {
        const fieldNames = denormalizedEntity.$type._fieldsByName;
        const normalizations = getNormalizationsFromState(entityKey, key, state);
        for (let field of iterKeys(normalizations)) {
            let value = get(normalizations, field);
            if (!fieldNames[field].resolvedType) {
                continue;
            }

            const type = fieldNames[field].resolvedType.fqn().toLowerCase();
            // Prevent circular relationships
            if (type === parent) {
                continue;
            }

            if (value instanceof Array || Immutable.Iterable.isIterable(value)) {
                denormalizedEntity.set(field, []);
                for (let id of iterValues(value)) {
                    // handle normal JS objects converting keys to strings
                    id = String(id);
                    const normalizedValue = getEntityFromState(type, id, state);
                    denormalizedEntity[field].push(
                        denormalizeEntity(normalizedValue, type, id, state, parent = entityKey)
                    );
                }
            } else {
                // handle normal JS objects converting keys to strings
                value = String(value);
                const normalizedValue = getEntityFromState(type, value, state);
                denormalizedEntity.set(field, denormalizeEntity(normalizedValue, type, value, state, parent = entityKey));
            }
        }
    }

    if (validator && !validator(denormalizedEntity, entityKey, key)) {
        return null;
    }

    return denormalizedEntity;
}

export default function normalize(obj, key=null) {
    let entities = {};
    let normalizations = {};
    let result = visit(obj, entities, normalizations, key);
    return { entities, normalizations, result };
}

/**
* Denormalizes the entity that is associated with the key.
*
* @param {Object} key
* @param {Builder} builder
* @param {Map} state
* @param {Function} validator Accepts three parameters (denormalized entity, entity key, key) and returns false if entity is invalid
* @return {Array}|{Object}|{Void} denormalized entity or null if invalid or not found
*/
export function denormalize(key, builder, state, validator = null) {
    const entityKey = getEntityKey(builder);
    if (!hasEntityTypeInEntities(entityKey, state)) {
        return;
    }
    if (Array.isArray(key) || Immutable.Iterable.isIterable(key)) {
        let entities = [];
        let entitiesValid = key.every(id => {
            // handle JS objects converting keys to strings
            id = String(id);
            const entity = getEntityFromState(entityKey, id, state);
            const denormalizedEntity = denormalizeEntity(entity, entityKey, id, state, undefined, validator);
            let entityValid = true;
            if (validator) {
                entityValid = validator(denormalizedEntity, entityKey, id);
            }
            if (entityValid) {
                entities.push(denormalizedEntity);
            }
            return entityValid;
        });
        if (entitiesValid) {
            return entities;
        } else {
            return null;
        }
    } else {
        const entity = getEntityFromState(entityKey, key, state);
        if (!entity) {
            return;
        }
        return denormalizeEntity(entity, entityKey, key, state, undefined, validator)
    }
}

export function getNormalizations(normalizationsKey, key, builder, state) {
    const entityKey = getEntityKey(builder);
    if (!hasEntityTypeInNormalizations(entityKey, state)) {
        return;
    }
    const normalizations = getNormalizationsFromState(entityKey, key, state);
    if (!normalizations) {
        return;
    }
    return normalizations[normalizationsKey];
}
