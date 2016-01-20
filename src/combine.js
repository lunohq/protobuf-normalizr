/**
 * Combine multiple validators into one.
 *
 * The validators will be called from left to right.
 *
 * @param {...Function} funcs the validator functions to combine
 * @returns {Function} A function that will call the validators from left to
 * right, exiting on the first validator that returns `false`.
 */
export default function combine(...funcs) {
    return (...args) => {
        for (let func of funcs) {
            if (!func(...args)) {
                return false;
            }
        }
        return true;
    }
}
