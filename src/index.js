const isProtobuf = (obj) => obj && obj.$type;

const isEntity = (obj, key=null) => {
    if (
        (obj && obj.hasOwnProperty('id') && obj.id !== null) ||
        (key !== null)
    ) {
        return true;

    }
    return false;
}

const getEntityKey = (entity) => {
    return entity.$type.fqn().toLowerCase();
}

const getEntityId = (entity, key=null) => {
    return key ? key : entity.get('id');
}

const normalizeField = (field, entity, entities, normalizations, key=null, merge=null) => {
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
            visit(childProtobuf, entities, normalizations, merge);
        })
        entity.set(field.name, null);
    } else if (isEntity(value)) {
        stored[field.name] = value.id;
        visit(value, entities, normalizations, merge);
        entity.set(field.name, null);
    }
}

const visitProtobuf = (entity, entities, normalizations, key=null) => {
    entity.$type._fields.map((field) => {
        normalizeField(field, entity, entities, normalizations, key);
    });
    return entity;
}

const visitArray = (obj, entities, normalizations, merge=null) => {
    const normalized = obj.map((childObj) => {
        return visit(childObj, entities, normalizations, merge);
    })
    return normalized;
}

const visitEntity = (entity, entities, normalizations, key=null, merge=null) => {
    const entityKey = getEntityKey(entity);
    const entityId = getEntityId(entity, key);

    if (!entities[entityKey]) {
        entities[entityKey] = {};
    }

    if (merge) {
        entities[entityKey][entityId] = merge(entities[entityKey][entityId], entity);
    } else {
        entities[entityKey][entityId] = entity;
    }
    visitProtobuf(entity, entities, normalizations, key);
    return entityId;
}

const visit = (obj, entities, normalizations, key=null, merge=null) => {
    if (isProtobuf(obj) && isEntity(obj, key)) {
        return visitEntity(obj, entities, normalizations, key, merge);
    } else if (isProtobuf(obj)) {
        return visitProtobuf(obj, entities, normalizations, merge);
    } else if (obj instanceof Array) {
        return visitArray(obj, entities, normalizations, merge);
    }

    return obj;
}

const denormalizeEntity = (entity, entityKey, key, state, parent = null, validator = null) => {
    // Create a copy of the entity which we'll denormalize. This ensures we're not inflating entities when
    // denormalizing.
    const denormalizedEntity = entity.$type.clazz.decode(entity.encode());
    if (!state.normalizations[entityKey]) {
        return denormalizedEntity;
    }

    const fieldNames = denormalizedEntity.$type._fieldsByName;
    const normalizations = state.normalizations[entityKey][key];
    for (let field in normalizations) {
        const value = normalizations[field];
        const type = fieldNames[field].resolvedType.fqn().toLowerCase();
        // Prevent circular relationships
        if (type === parent) {
            continue;
        }

        if (value instanceof Array) {
            denormalizedEntity.set(field, []);
            value.map((id) => {
                const normalizedValue = state.entities[type][id];
                denormalizedEntity[field].push(denormalizeEntity(normalizedValue, type, id, state, parent = entityKey));
            });
        } else {
            const normalizedValue = state.entities[type][value];
            denormalizedEntity.set(field, denormalizeEntity(normalizedValue, type, value, state, parent = entityKey));
        }
    }

    if (validator && !validator(denormalizedEntity, entityKey, key)) {
        return null;
    }

    return denormalizedEntity;
}

export default function normalize(obj, key=null, merge=null) {
    let entities = {};
    let normalizations = {};
    let result = visit(obj, entities, normalizations, key, merge);
    return { entities, normalizations, result };
}

export function denormalize(key, builder, state, validator) {
    const entityKey = getEntityKey(builder);
    if (!state.entities[entityKey]) {
        return;
    }
    if (Array.isArray(key)) {
        let valid = true;
        let entities = [];
        key.every(id => {
            const entity = state.entities[entityKey][id];
            const denormalizedEntity = denormalizeEntity(entity, entityKey, id, state, undefined, validator);
            if (validator) {
                valid = validator(denormalizedEntity, entityKey, id);
            }
            if (valid) {
                entities.push(denormalizedEntity);
            }
            return valid;
        });
        if (valid) {
            return entities;
        }
        else {
            return null;
        }
    } else {
        const entity = state.entities[entityKey][key];
        return denormalizeEntity(entity, entityKey, key, state, undefined, validator)
    }
}

export function getNormalizations(normalizationsKey, key, builder, state) {
    const entityKey = getEntityKey(builder);
    if (!state.normalizations[entityKey]) {
        return;
    }
    const normalizations = state.normalizations[entityKey][key];
    if (!normalizations) {
        return;
    }
    return normalizations[normalizationsKey];
}
