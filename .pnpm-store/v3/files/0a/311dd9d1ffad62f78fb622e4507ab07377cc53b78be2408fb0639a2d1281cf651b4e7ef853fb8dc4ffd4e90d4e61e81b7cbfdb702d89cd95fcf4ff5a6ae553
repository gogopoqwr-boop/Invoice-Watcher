Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") {
		for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
			key = keys[i];
			if (!__hasOwnProp.call(to, key) && key !== except) {
				__defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
		}
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
let _react_three_fiber = require("@react-three/fiber");
let _react_spring_core = require("@react-spring/core");
let _react_spring_shared = require("@react-spring/shared");
let _react_spring_animated = require("@react-spring/animated");
let three = require("three");
three = __toESM(three);

//#region src/primitives.ts
const primitives = ["primitive"].concat(Object.keys(three).filter((key) => /^[A-Z]/.test(key)).map((key) => key[0].toLowerCase() + key.slice(1)));

//#endregion
//#region src/index.ts
_react_spring_core.Globals.assign({
	createStringInterpolator: _react_spring_shared.createStringInterpolator,
	colors: _react_spring_shared.colors,
	frameLoop: "demand"
});
(0, _react_three_fiber.addEffect)(() => {
	_react_spring_shared.raf.advance();
});
const host = (0, _react_spring_animated.createHost)(primitives, { applyAnimatedValues: _react_three_fiber.applyProps });
const animated = host.animated;

//#endregion
exports.a = animated;
exports.animated = animated;
Object.keys(_react_spring_core).forEach(function (k) {
  if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
    enumerable: true,
    get: function () { return _react_spring_core[k]; }
  });
});
