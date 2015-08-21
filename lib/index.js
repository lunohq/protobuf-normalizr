'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
var isEntity = function isEntity(obj) {
    var key = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

    if (obj && obj.hasOwnProperty('id') && obj.id !== null || key !== null) {
        return true;
    }
    return false;
};

var getEntityKey = function getEntityKey(entity) {
    return entity.$type.name.toLowerCase();
};

var getEntityId = function getEntityId(entity) {
    var key = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

    return key ? key : entity.get('id');
};

var normalizeField = function normalizeField(field, protobuf, protobufs, normalizations) {
    var key = arguments.length <= 4 || arguments[4] === undefined ? null : arguments[4];

    var value = protobuf.get(field.name);
    if (!(field.repeated || isEntity(value, key))) {
        return;
    }

    var entityKey = getEntityKey(protobuf);
    var entityId = getEntityId(protobuf, key);
    if (!normalizations[entityKey]) {
        normalizations[entityKey] = {};
    }

    if (!normalizations[entityKey][entityId]) {
        normalizations[entityKey][entityId] = {};
    }

    var stored = normalizations[entityKey][entityId];
    if (field.repeated && value !== null) {
        if (!stored[field.name]) {
            stored[field.name] = [];
        }
        value.map(function (childProtobuf) {
            stored[field.name].push(childProtobuf.id);
            visit(childProtobuf, protobufs, normalizations);
        });
        protobuf.set(field.name, null);
    } else if (value !== null && isEntity(value)) {
        stored[field.name] = value.id;
        visit(value, protobufs, normalizations);
        protobuf.set(field.name, null);
    }
};

var visitProtobuf = function visitProtobuf(protobuf, protobufs, normalizations) {
    var key = arguments.length <= 3 || arguments[3] === undefined ? null : arguments[3];

    protobuf.$type._fields.map(function (field) {
        normalizeField(field, protobuf, protobufs, normalizations, key);
    });
    return protobuf;
};

var visitArray = function visitArray(obj, protobufs, normalizations) {
    var normalized = obj.map(function (childObj) {
        return visit(childObj, protobufs, normalizations);
    });
    return normalized;
};

var visitEntity = function visitEntity(entity, protobufs, normalizations) {
    var key = arguments.length <= 3 || arguments[3] === undefined ? null : arguments[3];

    var entityKey = getEntityKey(entity);
    var entityId = getEntityId(entity, key);

    if (!protobufs[entityKey]) {
        protobufs[entityKey] = {};
    }

    protobufs[entityKey][entityId] = entity;
    visitProtobuf(entity, protobufs, normalizations, key);
    return entityId;
};

var visit = function visit(obj, protobufs, normalizations) {
    var key = arguments.length <= 3 || arguments[3] === undefined ? null : arguments[3];

    if (obj.$type && isEntity(obj, key)) {
        return visitEntity(obj, protobufs, normalizations, key);
    } else if (obj.$type) {
        return visitProtobuf(obj, protobufs, normalizations);
    } else if (obj instanceof Array) {
        return visitArray(obj, protobufs, normalizations);
    }

    return obj;
};

var denormalizeProtobuf = function denormalizeProtobuf(protobuf, entityKey, key, state) {
    if (!state.normalizations[entityKey]) {
        return;
    }

    var fieldNames = protobuf.$type._fieldsByName;
    var normalizations = state.normalizations[entityKey][key];

    var _loop = function (field) {
        var value = normalizations[field];
        var type = fieldNames[field].resolvedType.name.toLowerCase();
        if (value instanceof Array) {
            protobuf.set(field, []);
            value.map(function (id) {
                protobuf[field].push(state.protobufs[type][id]);
            });
        } else {
            protobuf.set(field, state.protobufs[type][value]);
        }
    };

    for (var field in normalizations) {
        _loop(field);
    }
};

var normalize = function normalize(obj) {
    var key = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

    var protobufs = {};
    var normalizations = {};
    var result = visit(obj, protobufs, normalizations, key);
    return { protobufs: protobufs, normalizations: normalizations, result: result };
};

exports.normalize = normalize;
var denormalize = function denormalize(key, builder, state) {
    var entityKey = getEntityKey(builder);
    if (!state.protobufs[entityKey]) {
        return;
    }
    var protobuf = state.protobufs[entityKey][key];
    denormalizeProtobuf(protobuf, entityKey, key, state);
    return protobuf;
};

exports.denormalize = denormalize;
exports['default'] = normalize;