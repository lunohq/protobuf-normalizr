/**
 * Combine multiple validators into one.
 *
 * The validators will be called from left to right.
 *
 * @param {...Function} funcs the validator functions to combine
 * @returns {Function} A function that will call the validators from left to
 * right, exiting on the first validator that returns `false`.
 */
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports["default"] = combine;

function combine() {
    for (var _len = arguments.length, funcs = Array(_len), _key = 0; _key < _len; _key++) {
        funcs[_key] = arguments[_key];
    }

    return function () {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
            for (var _iterator = funcs[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var func = _step.value;

                if (!func.apply(undefined, arguments)) {
                    return false;
                }
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion && _iterator["return"]) {
                    _iterator["return"]();
                }
            } finally {
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }

        return true;
    };
}

module.exports = exports["default"];