'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
exports.createRequiredFieldsValidator = createRequiredFieldsValidator;
function entityHasValueForField(_x, _x2) {
    var _again = true;

    _function: while (_again) {
        var entity = _x,
            field = _x2;
        _again = false;

        var parts = field.split('.');
        var part = parts[0];
        var remainder = parts.slice(1).join('.');
        var value = entity[part];
        if (value !== undefined && value !== null) {
            if (remainder) {
                _x = value;
                _x2 = remainder;
                _again = true;
                parts = part = remainder = value = undefined;
                continue _function;
            }
            return true;
        }
        return false;
    }
}

function createRequiredFieldsValidator(fields) {
    return function (denormalizedEntity, entityKey, key) {
        if (fields) {
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                for (var _iterator = fields[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var field = _step.value;

                    if (!entityHasValueForField(denormalizedEntity, field)) {
                        return false;
                    }
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion && _iterator['return']) {
                        _iterator['return']();
                    }
                } finally {
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }
        }
        return true;
    };
}