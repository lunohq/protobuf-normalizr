'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
exports['default'] = normalize;
exports.denormalize = denormalize;
exports.getNormalizations = getNormalizations;
var isProtobuf = function isProtobuf(obj) {
    return obj && obj.$type;
};

var isEntity = function isEntity(obj) {
    var key = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

    if (obj && obj.hasOwnProperty('id') && obj.id !== null || key !== null) {
        return true;
    }
    return false;
};

var getEntityKey = function getEntityKey(entity) {
    return entity.$type.fqn().toLowerCase();
};

var getEntityId = function getEntityId(entity) {
    var key = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

    return key ? key : entity.get('id');
};

var normalizeField = function normalizeField(field, entity, entities, normalizations) {
    var key = arguments.length <= 4 || arguments[4] === undefined ? null : arguments[4];

    var value = entity.get(field.name);
    if (value === null || !(field.repeated && value.length || isEntity(value, key))) {
        return;
    }

    var entityKey = getEntityKey(entity);
    var entityId = getEntityId(entity, key);
    if (!normalizations[entityKey]) {
        normalizations[entityKey] = {};
    }

    if (!normalizations[entityKey][entityId]) {
        normalizations[entityKey][entityId] = {};
    }

    var stored = normalizations[entityKey][entityId];
    if (field.repeated) {
        if (!stored[field.name]) {
            stored[field.name] = [];
        }
        value.map(function (childProtobuf) {
            stored[field.name].push(childProtobuf.id);
            visit(childProtobuf, entities, normalizations);
        });
        entity.set(field.name, null);
    } else if (isEntity(value)) {
        stored[field.name] = value.id;
        visit(value, entities, normalizations);
        entity.set(field.name, null);
    }
};

var visitProtobuf = function visitProtobuf(entity, entities, normalizations) {
    var key = arguments.length <= 3 || arguments[3] === undefined ? null : arguments[3];

    entity.$type._fields.map(function (field) {
        normalizeField(field, entity, entities, normalizations, key);
    });
    return entity;
};

var visitArray = function visitArray(obj, entities, normalizations) {
    var normalized = obj.map(function (childObj) {
        return visit(childObj, entities, normalizations);
    });
    return normalized;
};

var visitEntity = function visitEntity(entity, entities, normalizations) {
    var key = arguments.length <= 3 || arguments[3] === undefined ? null : arguments[3];

    var entityKey = getEntityKey(entity);
    var entityId = getEntityId(entity, key);

    if (!entities[entityKey]) {
        entities[entityKey] = {};
    }

    entities[entityKey][entityId] = entity;
    visitProtobuf(entity, entities, normalizations, key);
    return entityId;
};

var visit = function visit(obj, entities, normalizations) {
    var key = arguments.length <= 3 || arguments[3] === undefined ? null : arguments[3];

    if (isProtobuf(obj) && isEntity(obj, key)) {
        return visitEntity(obj, entities, normalizations, key);
    } else if (isProtobuf(obj)) {
        return visitProtobuf(obj, entities, normalizations);
    } else if (obj instanceof Array) {
        return visitArray(obj, entities, normalizations);
    }

    return obj;
};

var denormalizeEntity = function denormalizeEntity(entity, entityKey, key, state) {
    if (!state.normalizations[entityKey]) {
        return;
    }

    var fieldNames = entity.$type._fieldsByName;
    var normalizations = state.normalizations[entityKey][key];

    var _loop = function (field) {
        var value = normalizations[field];
        var type = fieldNames[field].resolvedType.fqn().toLowerCase();
        if (value instanceof Array) {
            entity.set(field, []);
            value.map(function (id) {
                entity[field].push(state.entities[type][id]);
            });
        } else {
            entity.set(field, state.entities[type][value]);
        }
    };

    for (var field in normalizations) {
        _loop(field);
    }
};

function normalize(obj) {
    var key = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

    var entities = {};
    var normalizations = {};
    var result = visit(obj, entities, normalizations, key);
    return { entities: entities, normalizations: normalizations, result: result };
}

function denormalize(key, builder, state) {
    var entityKey = getEntityKey(builder);
    if (!state.entities[entityKey]) {
        return;
    }
    if (Array.isArray(key)) {
        return key.map(function (id) {
            var entity = state.entities[entityKey][id];
            denormalizeEntity(entity, entityKey, id, state);
            return entity;
        });
    } else {
        var entity = state.entities[entityKey][key];
        denormalizeEntity(entity, entityKey, key, state);
        return entity;
    }
}

function getNormalizations(normalizationsKey, key, builder, state) {
    var entityKey = getEntityKey(builder);
    if (!state.normalizations[entityKey]) {
        return;
    }
    var normalizations = state.normalizations[entityKey][key];
    if (!normalizations) {
        return;
    }
    return normalizations[normalizationsKey];
}