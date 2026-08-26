var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};

// src/plugin.ts
import z from "@deepseek-ai/schemastery";
import "@deepseek-ai/dsh-user-approval";
import "@deepseek-ai/dsh-user-questions";

// src/scope/index.ts
import { createHash as createHash4 } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { lstat as lstat5, open as open5, opendir as opendir4, realpath as realpath4, stat } from "node:fs/promises";
import { basename as basename3, dirname as dirname4, isAbsolute as isAbsolute3, join as join4, relative as relative3, resolve as resolve5, sep as sep3 } from "node:path";
import { performance as performance4 } from "node:perf_hooks";
import { promisify, TextDecoder as TextDecoder3 } from "node:util";

// node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index2) {
    return new _ZodObject({
      ...this._def,
      catchall: index2
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index2 = 0; index2 < a.length; index2++) {
      const itemA = a[index2];
      const itemB = b[index2];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index2) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index2, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index2, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// src/types/schema.ts
import { createHash } from "node:crypto";
import { lstat, open, opendir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep, win32 } from "node:path";

// src/knowledge/model.ts
var confidenceRank = { low: 0, medium: 1, high: 2 };
var confidenceByRank = ["low", "medium", "high"];
function typedEvidence(record) {
  return record.evidence.filter((value) => typeof value !== "string");
}
function ceiling(record) {
  const evidence = typedEvidence(record);
  if (evidence.length === 0) return { confidence: "low", reason: "no typed evidence supports this record" };
  const roles = new Set(evidence.map((value) => value.role));
  switch (record.kind) {
    case "intent":
    case "principle":
    case "decision":
      return record.approval === "confirmed" || roles.has("design") ? { confidence: "high" } : { confidence: "medium", reason: "high confidence requires confirmation or normative design evidence" };
    case "architecture":
    case "module":
    case "convention":
      return roles.has("design") && roles.has("implementation") ? { confidence: "high" } : { confidence: "medium", reason: "high confidence requires both normative design and implementation evidence" };
    case "tuning":
      return roles.has("configuration") && (roles.has("test") || roles.has("runtime")) ? { confidence: "high" } : { confidence: "medium", reason: "high confidence requires configuration plus test or runtime evidence" };
    case "verification":
      return roles.has("runtime") ? { confidence: "high" } : { confidence: "medium", reason: "a test definition without a current result is capped at medium" };
    default:
      return { confidence: roles.size > 0 ? "medium" : "low" };
  }
}
function assessRecord(record) {
  const asserted = record.assertedConfidence ?? "low";
  const evidenceCeiling = ceiling(record);
  const effectiveRank = Math.min(confidenceRank[asserted], confidenceRank[evidenceCeiling.confidence]);
  const effectiveConfidence = confidenceByRank[effectiveRank];
  return {
    id: record.id,
    effectiveConfidence,
    reasons: evidenceCeiling.reason && confidenceRank[asserted] > confidenceRank[evidenceCeiling.confidence] ? [evidenceCeiling.reason] : []
  };
}

// src/knowledge/jsonl.ts
import { TextDecoder as TextDecoder2 } from "node:util";

// src/security/limits.ts
import { performance } from "node:perf_hooks";
var keeperLimits = Object.freeze({
  mcpArgumentBytes: 8 * 1024 * 1024,
  preview: Object.freeze({
    maxChanges: 200,
    maxFileBytes: 2 * 1024 * 1024,
    maxAggregateBytes: 8 * 1024 * 1024,
    maxDiffBytes: 768 * 1024
  }),
  changesets: Object.freeze({
    maxPairsPerProject: 64,
    maxPairsGlobal: 256,
    maxTotalBytes: 128 * 1024 * 1024,
    maxChangesetBytes: 12 * 1024 * 1024,
    maxSignatureBytes: 4 * 1024
  }),
  pack: Object.freeze({
    maxDocuments: 256,
    maxRecords: 1e4,
    maxEvidencePerRecord: 128,
    maxImpactPerRecord: 128
  }),
  scan: Object.freeze({
    maxFiles: 1e5,
    maxFileBytes: 8 * 1024 * 1024,
    maxAggregateBytes: 256 * 1024 * 1024,
    maxEvidence: 25e4,
    deadlineMs: 6e4
  }),
  redundancy: Object.freeze({
    maxRecords: 1e4,
    maxPairs: 2e4,
    maxDecisions: 1e3
  })
});
var changesetRemovalRecoveryLimits = Object.freeze({
  maxEntries: keeperLimits.changesets.maxPairsGlobal * 4,
  maxWork: keeperLimits.changesets.maxPairsGlobal * 16,
  maxBytes: keeperLimits.changesets.maxTotalBytes,
  maxArtifactBytes: keeperLimits.changesets.maxChangesetBytes,
  deadlineMs: 3e4
});
function cappedOverride(label, hardLimit, override) {
  if (override === void 0) return hardLimit;
  positiveLimit(label, override, "units");
  return Math.min(override, hardLimit);
}
function resolveKeeperLimits(overrides = {}) {
  const preview = overrides.preview;
  const changesets = overrides.changesets;
  const pack = overrides.pack;
  const scan2 = overrides.scan;
  const redundancy = overrides.redundancy;
  return Object.freeze({
    mcpArgumentBytes: cappedOverride("MCP argument bytes", keeperLimits.mcpArgumentBytes, overrides.mcpArgumentBytes),
    preview: Object.freeze({
      maxChanges: cappedOverride("Preview changes", keeperLimits.preview.maxChanges, preview?.maxChanges),
      maxFileBytes: cappedOverride("Preview file bytes", keeperLimits.preview.maxFileBytes, preview?.maxFileBytes),
      maxAggregateBytes: cappedOverride("Preview aggregate bytes", keeperLimits.preview.maxAggregateBytes, preview?.maxAggregateBytes),
      maxDiffBytes: cappedOverride("Preview diff bytes", keeperLimits.preview.maxDiffBytes, preview?.maxDiffBytes)
    }),
    changesets: Object.freeze({
      maxPairsPerProject: cappedOverride("Changesets per project", keeperLimits.changesets.maxPairsPerProject, changesets?.maxPairsPerProject),
      maxPairsGlobal: cappedOverride("Global changesets", keeperLimits.changesets.maxPairsGlobal, changesets?.maxPairsGlobal),
      maxTotalBytes: cappedOverride("Changeset cache bytes", keeperLimits.changesets.maxTotalBytes, changesets?.maxTotalBytes),
      maxChangesetBytes: cappedOverride("Changeset bytes", keeperLimits.changesets.maxChangesetBytes, changesets?.maxChangesetBytes),
      maxSignatureBytes: cappedOverride("Changeset signature bytes", keeperLimits.changesets.maxSignatureBytes, changesets?.maxSignatureBytes)
    }),
    pack: Object.freeze({
      maxDocuments: cappedOverride("Pack documents", keeperLimits.pack.maxDocuments, pack?.maxDocuments),
      maxRecords: cappedOverride("Pack records", keeperLimits.pack.maxRecords, pack?.maxRecords),
      maxEvidencePerRecord: cappedOverride("Pack evidence", keeperLimits.pack.maxEvidencePerRecord, pack?.maxEvidencePerRecord),
      maxImpactPerRecord: cappedOverride("Pack impact", keeperLimits.pack.maxImpactPerRecord, pack?.maxImpactPerRecord)
    }),
    scan: Object.freeze({
      maxFiles: cappedOverride("Scan files", keeperLimits.scan.maxFiles, scan2?.maxFiles),
      maxFileBytes: cappedOverride("Scan file bytes", keeperLimits.scan.maxFileBytes, scan2?.maxFileBytes),
      maxAggregateBytes: cappedOverride("Scan aggregate bytes", keeperLimits.scan.maxAggregateBytes, scan2?.maxAggregateBytes),
      maxEvidence: cappedOverride("Scan evidence", keeperLimits.scan.maxEvidence, scan2?.maxEvidence),
      deadlineMs: cappedOverride("Scan deadline", keeperLimits.scan.deadlineMs, scan2?.deadlineMs)
    }),
    redundancy: Object.freeze({
      maxRecords: cappedOverride("Redundancy records", keeperLimits.redundancy.maxRecords, redundancy?.maxRecords),
      maxPairs: cappedOverride("Redundancy pairs", keeperLimits.redundancy.maxPairs, redundancy?.maxPairs),
      maxDecisions: cappedOverride("Redundancy decisions", keeperLimits.redundancy.maxDecisions, redundancy?.maxDecisions)
    })
  });
}
function positiveLimit(label, value, unit) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} limit must be a non-negative integer ${unit}`);
}
function exceeded(label, max, unit) {
  return new Error(`${label} exceeds the limit of ${max} ${unit}`);
}
function serializedBytes(value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error("Value cannot be serialized for resource-limit measurement");
  }
  if (serialized === void 0) throw new Error("Value cannot be serialized for resource-limit measurement");
  return Buffer.byteLength(serialized, "utf8");
}
function assertSerializedWithin(label, value, maxBytes) {
  positiveLimit(label, maxBytes, "bytes");
  if (serializedBytes(value) > maxBytes) throw exceeded(label, maxBytes, "bytes");
}
var mcpToolResultBudgetBytes = 1024 * 1024;
var mcpToolResultEnvelopeReserveBytes = 16 * 1024;
function assertToolResultBudget(value) {
  if (serializedBytes(value) > mcpToolResultBudgetBytes - mcpToolResultEnvelopeReserveBytes) {
    throw new Error("MCP structured response exceeds the one MiB response budget; narrow the request or use pagination");
  }
}
function assertStringWithin(label, value, maxBytes) {
  positiveLimit(label, maxBytes, "bytes");
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  if (Buffer.byteLength(value, "utf8") > maxBytes) throw exceeded(label, maxBytes, "bytes");
}
var ByteBudget = class {
  constructor(label, maxBytes) {
    this.label = label;
    this.maxBytes = maxBytes;
    positiveLimit(label, maxBytes, "bytes");
  }
  #used = 0;
  consume(bytes) {
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error(`${this.label} consumption must be a non-negative integer number of bytes`);
    if (this.#used + bytes > this.maxBytes) throw exceeded(this.label, this.maxBytes, "bytes");
    this.#used += bytes;
  }
};
var CounterBudget = class {
  constructor(label, maxItems) {
    this.label = label;
    this.maxItems = maxItems;
    positiveLimit(label, maxItems, "items");
  }
  #used = 0;
  consume(items = 1) {
    if (!Number.isSafeInteger(items) || items < 0) throw new Error(`${this.label} consumption must be a non-negative integer number of items`);
    if (this.#used + items > this.maxItems) throw exceeded(this.label, this.maxItems, "items");
    this.#used += items;
  }
};
var DeadlineBudget = class {
  constructor(label, durationMs, now = () => performance.now()) {
    this.label = label;
    this.durationMs = durationMs;
    this.now = now;
    positiveLimit(label, durationMs, "milliseconds");
    this.#startedAt = now();
  }
  #startedAt;
  check() {
    if (this.now() - this.#startedAt >= this.durationMs) {
      throw new Error(`${this.label} deadline of ${this.durationMs} milliseconds exceeded`);
    }
  }
};

// src/knowledge/jsonl.ts
var CanonicalJsonLinesError = class extends Error {
  constructor(kind, message, line) {
    super(message);
    this.kind = kind;
    this.line = line;
    this.name = "CanonicalJsonLinesError";
  }
};
function decodeCanonicalJsonLines(bytes, label, options = {}) {
  const maxBytes = options.maxBytes ?? keeperLimits.preview.maxFileBytes;
  const maxLines = options.maxLines ?? keeperLimits.pack.maxRecords;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes > keeperLimits.preview.maxFileBytes) {
    throw new CanonicalJsonLinesError("size", `${label} byte limit is invalid`);
  }
  if (!Number.isSafeInteger(maxLines) || maxLines < 0 || maxLines > keeperLimits.pack.maxRecords) {
    throw new CanonicalJsonLinesError("count", `${label} line limit is invalid`);
  }
  if (bytes.byteLength > maxBytes) {
    throw new CanonicalJsonLinesError("size", `${label} exceeds the JSONL file limit of ${maxBytes} bytes`);
  }
  if (bytes.length >= 3 && bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191) {
    throw new CanonicalJsonLinesError("encoding", `${label} JSONL has a forbidden UTF-8 BOM`);
  }
  let text;
  try {
    text = new TextDecoder2("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CanonicalJsonLinesError("encoding", `${label} JSONL is not valid UTF-8`);
  }
  let lines;
  if (text.length === 0) {
    lines = [];
  } else {
    if (!text.endsWith("\n") || text.endsWith("\n\n") || text.includes("\r")) {
      throw new CanonicalJsonLinesError(
        "format",
        `${label} JSONL must end with exactly one canonical LF and contain no CR characters`
      );
    }
    lines = text.slice(0, -1).split("\n");
    const blank = lines.findIndex((line) => line.trim().length === 0);
    if (blank >= 0) {
      throw new CanonicalJsonLinesError("format", `${label} JSONL has a blank line at ${blank + 1}`, blank + 1);
    }
    const padded = lines.findIndex((line) => line !== line.trim());
    if (padded >= 0) {
      throw new CanonicalJsonLinesError(
        "format",
        `${label} JSONL has noncanonical surrounding whitespace at line ${padded + 1}`,
        padded + 1
      );
    }
  }
  if (lines.length > maxLines) {
    throw new CanonicalJsonLinesError("count", `${label} exceeds the JSONL line limit of ${maxLines}`);
  }
  if (options.expectedCount !== void 0) {
    const expected = options.expectedCount;
    if (!Number.isSafeInteger(expected) || Number(expected) < 0 || Number(expected) > maxLines) {
      throw new CanonicalJsonLinesError("count", `${label} expected line count is invalid`);
    }
    if (lines.length !== expected) {
      throw new CanonicalJsonLinesError(
        "count",
        `${label} declares ${String(expected)} entries but contains ${lines.length}`
      );
    }
  }
  return lines.map((line, index2) => {
    try {
      return { value: JSON.parse(line), line: index2 + 1 };
    } catch {
      throw new CanonicalJsonLinesError("json", `${label} JSONL is malformed at line ${index2 + 1}`, index2 + 1);
    }
  });
}

// src/types/schema.ts
var scopeOmissionReasons = [
  "file-limit",
  "file-bytes",
  "aggregate-bytes",
  "evidence-limit",
  "deadline",
  "binary",
  "unsafe",
  "unreadable"
];
var scopeFileEntrySchema = external_exports.object({
  path: external_exports.string().refine((path) => safeRepositoryPath(path), "must be a safe repository path"),
  fingerprint: external_exports.string().regex(/^sha256:[a-f0-9]{64}$/u),
  size: external_exports.number().int().nonnegative().max(keeperLimits.scan.maxFileBytes),
  lineCount: external_exports.number().int().nonnegative().max(keeperLimits.scan.maxEvidence)
}).strict();
var scopeEvidenceSchema = external_exports.object({
  path: external_exports.string().refine((path) => safeRepositoryPath(path), "must be a safe repository path"),
  line: external_exports.number().int().positive().max(keeperLimits.scan.maxEvidence),
  text: external_exports.string(),
  truncated: external_exports.literal(true).optional(),
  textBytes: external_exports.number().int().positive().max(keeperLimits.scan.maxFileBytes).optional()
}).strict().superRefine((evidence, context) => {
  const prefixBytes = Buffer.byteLength(evidence.text, "utf8");
  if (prefixBytes > 16 * 1024) {
    context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["text"], message: "must be at most 16 KiB" });
  }
  if (evidence.truncated === true) {
    if (evidence.textBytes === void 0 || evidence.textBytes <= prefixBytes) {
      context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["textBytes"], message: "must exceed the returned prefix bytes" });
    }
  } else if (evidence.textBytes !== void 0) {
    context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["textBytes"], message: "is only allowed for truncated evidence" });
  }
});
var scopePathArraySchema = external_exports.array(external_exports.union([
  external_exports.literal("."),
  external_exports.string().refine((path) => safeRepositoryPath(path))
])).min(1).max(keeperLimits.scan.maxFiles).superRefine((paths, context) => {
  const seen = /* @__PURE__ */ new Set();
  for (const [index2, path] of paths.entries()) {
    const key = path === "." ? path : windowsRepositoryPathKey(path);
    if (seen.has(key)) {
      context.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: [index2],
        message: "scope paths must not contain Windows-equivalent aliases"
      });
    }
    seen.add(key);
  }
});
var candidateModuleSchema = external_exports.object({
  id: external_exports.string().min(1).max(512),
  paths: scopePathArraySchema,
  fileCount: external_exports.number().int().nonnegative().max(keeperLimits.scan.maxFiles),
  evidenceCount: external_exports.number().int().nonnegative().max(keeperLimits.scan.maxEvidence)
}).strict();
var scopeOmissionSchema = external_exports.object({
  path: external_exports.union([external_exports.literal("."), external_exports.string().refine((path) => safeRepositoryPath(path))]),
  reason: external_exports.enum(scopeOmissionReasons),
  size: external_exports.number().int().nonnegative().optional()
}).strict();
var scopeShardSchema = external_exports.object({
  path: external_exports.enum(["files.jsonl", "evidence.jsonl", "details.jsonl"]),
  bytes: external_exports.number().int().nonnegative().max(keeperLimits.scan.maxAggregateBytes),
  hash: external_exports.string().regex(/^sha256:[a-f0-9]{64}$/u),
  count: external_exports.number().int().nonnegative().max(keeperLimits.scan.maxEvidence)
}).strict();
var scopeLineRangeSchema = external_exports.object({
  startLine: external_exports.number().int().positive().safe(),
  endLine: external_exports.number().int().positive().safe().optional()
}).strict().superRefine((range, context) => {
  if (range.endLine !== void 0 && range.endLine < range.startLine) {
    context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["endLine"], message: "must not precede startLine" });
  }
});
var scopeRepositoryPathSchema = external_exports.string().refine((path) => safeRepositoryPath(path), "must be a canonical repository-relative path");
var scopeRelocationCandidateSchema = external_exports.object({
  recordId: external_exports.string().min(1).max(512),
  evidenceIndex: external_exports.number().int().nonnegative().safe().max(keeperLimits.pack.maxEvidencePerRecord - 1),
  path: scopeRepositoryPathSchema,
  from: scopeLineRangeSchema,
  to: scopeLineRangeSchema
}).strict();
var scopeDriftRecordId = external_exports.string().min(1).max(512);
var scopeDriftEvidence = external_exports.string().min(1).max(keeperLimits.scan.maxFileBytes);
var scopeDriftDetailSchema = external_exports.discriminatedUnion("kind", [
  external_exports.object({ kind: external_exports.enum(["new", "modified", "deleted"]), path: scopeRepositoryPathSchema }).strict(),
  external_exports.object({ kind: external_exports.literal("missing-evidence"), evidence: scopeDriftEvidence, recordId: scopeDriftRecordId.optional() }).strict(),
  external_exports.object({ kind: external_exports.enum(["deleted-evidence", "modified-evidence"]), recordId: scopeDriftRecordId, evidence: scopeDriftEvidence }).strict(),
  external_exports.object({
    kind: external_exports.literal("invalid-evidence"),
    recordId: scopeDriftRecordId,
    evidence: scopeDriftEvidence,
    reason: external_exports.literal("line-invalid")
  }).strict()
]);
var scopeDriftSummarySchema = external_exports.object({
  freshness: external_exports.enum(["unknown", "stale", "fresh"]),
  counts: external_exports.object({
    new: external_exports.number().int().nonnegative().max(keeperLimits.scan.maxFiles),
    modified: external_exports.number().int().nonnegative().max(keeperLimits.scan.maxFiles),
    deleted: external_exports.number().int().nonnegative().max(keeperLimits.scan.maxFiles),
    invalidated: external_exports.number().int().nonnegative().max(keeperLimits.pack.maxRecords)
  }).strict(),
  invalidatedRecordIds: external_exports.array(external_exports.string().min(1).max(512)).max(keeperLimits.pack.maxRecords),
  relocationCandidates: external_exports.array(scopeRelocationCandidateSchema).max(keeperLimits.scan.maxEvidence),
  archiveEligibleRecordIds: external_exports.array(external_exports.string().min(1).max(512)).max(keeperLimits.pack.maxRecords)
}).strict().superRefine((summary, context) => {
  if (summary.counts.invalidated !== summary.invalidatedRecordIds.length) {
    context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["counts", "invalidated"], message: "must match invalidated record IDs" });
  }
  for (const [field, values] of [
    ["invalidatedRecordIds", summary.invalidatedRecordIds],
    ["archiveEligibleRecordIds", summary.archiveEligibleRecordIds]
  ]) {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: external_exports.ZodIssueCode.custom, path: [field], message: "must contain unique IDs" });
    }
  }
});
var scopeIndexMetadataV3Schema = external_exports.object({
  version: external_exports.literal(3),
  createdAt: external_exports.number().int().nonnegative().safe(),
  expiresAt: external_exports.number().int().positive().safe(),
  projectKey: external_exports.string().regex(/^[a-f0-9]{64}$/u),
  scopeKey: external_exports.string().regex(/^[a-f0-9]{64}$/u),
  cursorScopeKey: external_exports.string().regex(/^[a-f0-9]{64}$/u),
  scopePaths: scopePathArraySchema,
  snapshotId: external_exports.string().regex(/^sha256:[a-f0-9]{64}$/u),
  shards: external_exports.object({
    files: scopeShardSchema.refine((shard) => shard.path === "files.jsonl"),
    evidence: scopeShardSchema.refine((shard) => shard.path === "evidence.jsonl"),
    details: scopeShardSchema.refine((shard) => shard.path === "details.jsonl").optional()
  }).strict(),
  totals: external_exports.object({
    files: external_exports.number().int().nonnegative().max(keeperLimits.scan.maxFiles),
    evidence: external_exports.number().int().nonnegative().max(keeperLimits.scan.maxEvidence),
    omitted: external_exports.number().int().nonnegative().max(keeperLimits.scan.maxFiles + 1),
    details: external_exports.number().int().nonnegative().max(keeperLimits.scan.maxEvidence).optional()
  }).strict(),
  candidateModules: external_exports.array(candidateModuleSchema).max(keeperLimits.scan.maxFiles),
  omissions: external_exports.array(scopeOmissionSchema).max(keeperLimits.scan.maxFiles + 1),
  driftSummary: scopeDriftSummarySchema.optional()
}).strict().superRefine((metadata, context) => {
  if (metadata.expiresAt !== metadata.createdAt + 7 * 24 * 60 * 60 * 1e3) {
    context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["expiresAt"], message: "must be exactly seven days after createdAt" });
  }
  if (metadata.totals.files !== metadata.shards.files.count || metadata.totals.evidence !== metadata.shards.evidence.count || metadata.totals.omitted !== metadata.omissions.length || metadata.totals.details !== metadata.shards.details?.count) {
    context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["totals"], message: "must exactly match shard and omission counts" });
  }
  if (Boolean(metadata.shards.details) !== Boolean(metadata.driftSummary)) {
    context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["driftSummary"], message: "must be present exactly when a detail shard is present" });
  }
  const omissionPaths = /* @__PURE__ */ new Set();
  for (const [index2, omission] of metadata.omissions.entries()) {
    const key = omission.path === "." ? omission.path : windowsRepositoryPathKey(omission.path);
    if (omissionPaths.has(key)) {
      context.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["omissions", index2, "path"],
        message: "must not duplicate a Windows-equivalent omission path"
      });
    }
    omissionPaths.add(key);
  }
});
var changesetLifetimeMs = 30 * 60 * 1e3;
var stableId = external_exports.string().min(1).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u, "must be a stable identifier");
var canonicalUuidSchema = external_exports.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
  "must be a lowercase canonical UUID"
);
function isCanonicalUuid(value) {
  return canonicalUuidSchema.safeParse(value).success;
}
var sha256Hash = external_exports.string().regex(/^sha256:[a-f0-9]{64}$/u);
var diffDigestSchema = sha256Hash.transform((value) => value);
var reservedWindowsName = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
var invalidWindowsCharacters = /[\u0000-\u001f<>:"|?*]/u;
function safeRepositoryPath(path, managedOnly = false) {
  if (!path || path.includes("\\") || /^[A-Za-z]:|^\//u.test(path)) return false;
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || /[. ]$/u.test(part) || invalidWindowsCharacters.test(part) || reservedWindowsName.test(part))) return false;
  return !managedOnly || path.startsWith("docs/project-design/") || path.startsWith(".agents/skills/project-design-context/");
}
function windowsRepositoryPathKey(path) {
  return path.split("/").map((part) => part.toLocaleLowerCase("en-US")).join("/");
}
var repositoryPath = external_exports.string().refine((path) => safeRepositoryPath(path), "must be a canonical repository-relative path");
var documentPath = external_exports.string().refine((path) => safeRepositoryPath(path, true), "must be a safe canonical managed document path");
var manifestDocumentPath = external_exports.string().refine(
  (path) => safeRepositoryPath(path) && path.startsWith("docs/project-design/") && path.endsWith(".md"),
  "must be a canonical Markdown path under docs/project-design"
);
var requiredDocumentPaths = [
  "docs/project-design/index.md",
  "docs/project-design/intent.md",
  "docs/project-design/principles.md",
  "docs/project-design/architecture.md",
  "docs/project-design/conventions.md",
  "docs/project-design/decisions.md",
  "docs/project-design/open-questions.md",
  "docs/project-design/evidence-map.md"
];
var v2RequiredDocumentPaths = [
  ...requiredDocumentPaths,
  "docs/project-design/tuning.md",
  "docs/project-design/verification.md"
];
var knowledgeKinds = [
  "intent",
  "principle",
  "architecture",
  "module",
  "convention",
  "decision",
  "tuning",
  "verification",
  "open-question"
];
var evidenceRoleSchema = external_exports.enum(["design", "implementation", "test", "configuration", "runtime"]);
var typedEvidenceSchema = external_exports.object({
  path: repositoryPath,
  startLine: external_exports.number().int().min(1),
  endLine: external_exports.number().int().min(1).optional(),
  role: evidenceRoleSchema,
  excerptHash: sha256Hash
}).strict().superRefine((evidence, context) => {
  if (evidence.endLine !== void 0 && evidence.endLine < evidence.startLine) {
    context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["endLine"], message: "must be greater than or equal to startLine" });
  }
});
var lifecycleSchema = external_exports.discriminatedUnion("state", [
  external_exports.object({ state: external_exports.literal("active") }).strict(),
  external_exports.object({
    state: external_exports.literal("terminal"),
    reason: external_exports.enum(["superseded", "resolved", "replaced", "merged"]),
    sinceRevision: external_exports.number().int().nonnegative(),
    confirmedRefreshes: external_exports.number().int().min(0),
    successorIds: external_exports.array(stableId).max(keeperLimits.pack.maxRecords)
  }).strict()
]);
var tombstoneSchema = external_exports.object({
  id: stableId.max(256),
  reason: external_exports.enum(["superseded", "resolved", "replaced", "merged"]),
  successorIds: external_exports.array(stableId.max(256)).max(256),
  contentHash: sha256Hash,
  archivedAt: external_exports.string().datetime()
}).strict();
var knowledgeRecordSchema = external_exports.object({
  id: stableId,
  domain: external_exports.string().min(1),
  scope: external_exports.string().min(1),
  statement: external_exports.string().min(1),
  evidence: external_exports.array(external_exports.union([external_exports.string().min(1), typedEvidenceSchema])),
  impact: external_exports.array(external_exports.string().min(1)),
  status: external_exports.enum(["declared", "observed", "inferred", "proposed", "conflicted", "superseded"]),
  strength: external_exports.enum(["required", "preferred", "informational", "pending"]),
  approval: external_exports.enum(["confirmed", "pending", "not-required"]),
  confidence: external_exports.enum(["high", "medium", "low"]).optional(),
  assertedConfidence: external_exports.enum(["high", "medium", "low"]).optional(),
  lifecycle: lifecycleSchema.optional(),
  kind: external_exports.enum(knowledgeKinds).optional(),
  ownerDocument: stableId.optional(),
  supersedes: stableId.optional(),
  supersededBy: stableId.optional()
}).passthrough().superRefine((record, context) => {
  if ((record.strength === "required" || record.strength === "preferred") && record.approval !== "confirmed") {
    context.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["approval"],
      message: `${record.strength} knowledge must be user-confirmed`
    });
  }
});
var strictHistoryLifecycleSchema = external_exports.discriminatedUnion("state", [
  external_exports.object({ state: external_exports.literal("active") }).strict(),
  external_exports.object({
    state: external_exports.literal("terminal"),
    reason: external_exports.enum(["superseded", "resolved", "replaced", "merged"]),
    sinceRevision: external_exports.number().int().nonnegative().safe(),
    confirmedRefreshes: external_exports.number().int().nonnegative().safe(),
    successorIds: external_exports.array(stableId.max(256)).max(256)
  }).strict()
]);
var strictHistoryStatusSchema = external_exports.enum(["declared", "observed", "inferred", "proposed", "conflicted", "superseded"]);
var strictHistoryStringArray = external_exports.array(external_exports.string().min(1)).max(keeperLimits.pack.maxImpactPerRecord);
var strictHistoryTypedEvidenceSchema = typedEvidenceSchema.superRefine((evidence, context) => {
  if (!Number.isSafeInteger(evidence.startLine)) {
    context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["startLine"], message: "must be a safe integer" });
  }
  if (evidence.endLine !== void 0 && !Number.isSafeInteger(evidence.endLine)) {
    context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["endLine"], message: "must be a safe integer" });
  }
});
var strictHistoryKnowledgeRecordSchema = external_exports.object({
  id: stableId.max(256),
  domain: external_exports.string().min(1),
  scope: external_exports.string().min(1),
  statement: external_exports.string().min(1),
  evidence: external_exports.array(strictHistoryTypedEvidenceSchema).max(keeperLimits.pack.maxEvidencePerRecord),
  impact: external_exports.array(external_exports.string().min(1)).max(keeperLimits.pack.maxImpactPerRecord),
  status: strictHistoryStatusSchema,
  strength: external_exports.enum(["required", "preferred", "informational", "pending"]),
  approval: external_exports.enum(["confirmed", "pending", "not-required"]),
  assertedConfidence: external_exports.enum(["high", "medium", "low"]),
  lifecycle: strictHistoryLifecycleSchema,
  kind: external_exports.enum(knowledgeKinds),
  ownerDocument: stableId.max(256),
  supersedes: stableId.max(256).optional(),
  supersededBy: stableId.max(256).optional(),
  legacyEvidence: external_exports.array(external_exports.union([external_exports.string().min(1), strictHistoryTypedEvidenceSchema])).max(keeperLimits.pack.maxEvidencePerRecord).optional(),
  legacyStatus: strictHistoryStatusSchema.optional(),
  conflicts: strictHistoryStringArray.optional(),
  openQuestions: strictHistoryStringArray.optional(),
  module: external_exports.union([external_exports.string().min(1), strictHistoryStringArray]).optional(),
  modules: strictHistoryStringArray.optional(),
  path: repositoryPath.optional(),
  paths: external_exports.array(repositoryPath).max(keeperLimits.pack.maxEvidencePerRecord).optional(),
  summary: external_exports.string().min(1).optional()
}).strict().superRefine((record, context) => {
  if ((record.strength === "required" || record.strength === "preferred") && record.approval !== "confirmed") {
    context.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["approval"],
      message: `${record.strength} knowledge must be user-confirmed`
    });
  }
  if (record.statement !== record.statement.trim() || /\r|\n/u.test(record.statement)) {
    context.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["statement"],
      message: "Schema 3.0 historical statements must be one trimmed atomic line"
    });
  }
});
var archiveEntrySchema = external_exports.object({
  record: strictHistoryKnowledgeRecordSchema,
  originalOwnerDocument: stableId,
  managedBody: external_exports.string(),
  contentHash: sha256Hash,
  evidenceHash: sha256Hash,
  terminalReason: external_exports.enum(["superseded", "resolved", "replaced", "merged"]),
  maintenanceRevision: external_exports.number().int().nonnegative().safe(),
  archivedAt: external_exports.string().datetime()
}).strict();
function isCompleteArchiveEntry(value) {
  const parsed = archiveEntrySchema.safeParse(value);
  if (!parsed.success) return false;
  const entry = parsed.data;
  const record = entry.record;
  const terminal = record.lifecycle;
  return typeof record.kind === "string" && typeof record.ownerDocument === "string" && typeof record.assertedConfidence === "string" && record.evidence.every((evidence) => typeof evidence !== "string") && terminal?.state === "terminal" && Number.isSafeInteger(terminal.confirmedRefreshes) && terminal.confirmedRefreshes >= 2 && entry.contentHash === `sha256:${createHash("sha256").update(entry.managedBody, "utf8").digest("hex")}` && entry.evidenceHash === `sha256:${createHash("sha256").update(JSON.stringify(record.evidence), "utf8").digest("hex")}` && entry.originalOwnerDocument === record.ownerDocument && entry.terminalReason === terminal.reason;
}
var canonicalPackSchema = external_exports.object({
  managedBy: external_exports.literal("project-design-keeper"),
  schemaVersion: external_exports.enum(["1.0", "2.0", "3.0"]),
  scope: external_exports.object({
    root: external_exports.literal("."),
    paths: external_exports.array(repositoryPath).nonempty().optional()
  }).passthrough(),
  sourceRevision: external_exports.object({
    kind: external_exports.string().min(1),
    files: external_exports.record(repositoryPath, sha256Hash).refine((files) => Object.keys(files).length > 0, "must contain source files")
  }).passthrough(),
  documents: external_exports.array(external_exports.object({ id: stableId, path: manifestDocumentPath }).passthrough()),
  records: external_exports.array(knowledgeRecordSchema),
  maintenanceRevision: external_exports.number().int().nonnegative().optional(),
  archive: external_exports.object({
    generations: external_exports.array(external_exports.object({
      id: external_exports.string().regex(/^generation-[0-9]{6}$/u),
      path: repositoryPath,
      recordCount: external_exports.number().int().nonnegative(),
      createdAt: external_exports.string().datetime()
    }).strict()),
    tombstones: external_exports.object({ path: repositoryPath, count: external_exports.number().int().nonnegative() }).strict()
  }).strict().optional(),
  dedupeExceptions: external_exports.array(external_exports.object({
    leftId: stableId,
    rightId: stableId,
    leftDigest: sha256Hash,
    rightDigest: sha256Hash
  }).strict()).optional()
}).passthrough().superRefine((pack, context) => {
  const seenIds = /* @__PURE__ */ new Set();
  const duplicateIds = /* @__PURE__ */ new Set();
  for (const id of [...pack.documents.map((document) => document.id), ...pack.records.map((record) => record.id)]) {
    if (seenIds.has(id)) duplicateIds.add(id);
    else seenIds.add(id);
  }
  for (const duplicate of duplicateIds) {
    context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["records"], message: `duplicate id: ${duplicate}` });
  }
  const recordIds = new Set(pack.records.map((record) => record.id));
  const edges = /* @__PURE__ */ new Map();
  const indegree = new Map([...recordIds].map((id) => [id, 0]));
  const addEdge = (from, to, path) => {
    if (!recordIds.has(from)) {
      context.addIssue({ code: external_exports.ZodIssueCode.custom, path, message: `unknown supersession record: ${from}` });
      return;
    }
    if (!recordIds.has(to)) {
      context.addIssue({ code: external_exports.ZodIssueCode.custom, path, message: `unknown supersession record: ${to}` });
      return;
    }
    if (from === to) {
      context.addIssue({ code: external_exports.ZodIssueCode.custom, path, message: "a record cannot supersede itself" });
      return;
    }
    const outgoing = edges.get(from) ?? /* @__PURE__ */ new Set();
    if (!outgoing.has(to)) {
      outgoing.add(to);
      indegree.set(to, (indegree.get(to) ?? 0) + 1);
    }
    edges.set(from, outgoing);
  };
  pack.records.forEach((record, index2) => {
    if (pack.schemaVersion !== "3.0" && !record.confidence) {
      context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["records", index2, "confidence"], message: "Required" });
    }
    if (record.supersedes) addEdge(record.id, record.supersedes, ["records", index2, "supersedes"]);
    if (record.supersededBy) addEdge(record.supersededBy, record.id, ["records", index2, "supersededBy"]);
    if (record.lifecycle?.state === "terminal") {
      for (const [successorIndex, successorId] of record.lifecycle.successorIds.entries()) {
        addEdge(successorId, record.id, ["records", index2, "lifecycle", "successorIds", successorIndex]);
      }
    }
  });
  const pending = [...recordIds].filter((id) => indegree.get(id) === 0);
  let processed = 0;
  for (let index2 = 0; index2 < pending.length; index2 += 1) {
    const id = pending[index2];
    processed += 1;
    for (const successor of edges.get(id) ?? []) {
      const remaining = (indegree.get(successor) ?? 0) - 1;
      indegree.set(successor, remaining);
      if (remaining === 0) pending.push(successor);
    }
  }
  if (processed !== recordIds.size) {
    context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["records"], message: "supersession graph contains a cycle" });
  }
});
var packValidationManagedTreeMaximumDepth = 16;
var packValidationManagedTreeMaximumEntries = 4096;
function validationDiagnostic(code, path, message) {
  return { code, path, message };
}
function repositoryPathAliasDiagnostics(pack, overlay, onPath) {
  const diagnostics = [];
  const seen = /* @__PURE__ */ new Map();
  const register = (path, location) => {
    if (path === void 0) return;
    onPath();
    const key = windowsRepositoryPathKey(path);
    const prior = seen.get(key);
    if (prior && prior.path !== path) {
      diagnostics.push(validationDiagnostic(
        "repository_path_alias",
        location,
        `Repository path ${path} aliases ${prior.path} from ${prior.location} under Windows path rules`
      ));
    } else if (!prior) {
      seen.set(key, { path, location });
    }
  };
  for (const [index2, path] of (pack.scope.paths ?? []).entries()) register(path, `scope.paths.${index2}`);
  for (const path of Object.keys(pack.sourceRevision.files)) register(path, `sourceRevision.files.${path}`);
  for (const [index2, document] of pack.documents.entries()) register(document.path, `documents.${index2}.path`);
  for (const [recordIndex, record] of pack.records.entries()) {
    for (const [evidenceIndex, evidence] of record.evidence.entries()) {
      const path = typeof evidence === "string" ? /^(.*):[0-9]+$/u.exec(evidence)?.[1] : evidence.path;
      register(path, `records.${recordIndex}.evidence.${evidenceIndex}`);
    }
  }
  for (const [index2, generation] of (pack.archive?.generations ?? []).entries()) {
    register(generation.path, `archive.generations.${index2}.path`);
  }
  if (pack.archive) register(pack.archive.tombstones.path, "archive.tombstones.path");
  let overlayIndex = 0;
  for (const [path] of overlay ?? []) {
    register(path, `overlay.${overlayIndex}`);
    overlayIndex += 1;
  }
  return diagnostics;
}
function isInsideRoot(root, target) {
  const difference = relative(root, target);
  return difference === "" || !difference.startsWith(`..${sep}`) && difference !== ".." && !isAbsolute(difference);
}
function sameResolvedPath(left, right) {
  const normalizedLeft = resolve(left);
  const normalizedRight = resolve(right);
  return process.platform === "win32" ? normalizedLeft.toLocaleLowerCase("en-US") === normalizedRight.toLocaleLowerCase("en-US") : normalizedLeft === normalizedRight;
}
function sameFileVersion(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.gid === right.gid && left.mode === right.mode && left.nlink === right.nlink && left.size === right.size && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs && left.isFile() && right.isFile() && !left.isSymbolicLink() && !right.isSymbolicLink();
}
function sameDirectoryVersion(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.gid === right.gid && left.mode === right.mode && left.nlink === right.nlink && left.size === right.size && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs && left.isDirectory() && right.isDirectory() && !left.isSymbolicLink() && !right.isSymbolicLink();
}
function samePathVersion(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.gid === right.gid && left.mode === right.mode && left.nlink === right.nlink && left.size === right.size && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs && left.isFile() === right.isFile() && left.isDirectory() === right.isDirectory() && left.isSymbolicLink() === right.isSymbolicLink();
}
async function optionalMetadata(path) {
  try {
    return await lstat(path, { bigint: true });
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
function assertPackArrayLimit(label, value, maximum) {
  if (Array.isArray(value) && value.length > maximum) {
    throw new Error(`${label} exceeds the limit of ${maximum} items`);
  }
}
function consumeJsonStringBytes(value, bytes, deadline) {
  bytes.consume(2);
  let pendingBytes = 0;
  for (let index2 = 0; index2 < value.length; index2 += 1) {
    if ((index2 & 4095) === 0) {
      bytes.consume(pendingBytes);
      pendingBytes = 0;
      deadline.check();
    }
    const code = value.charCodeAt(index2);
    if (code === 34 || code === 92 || code === 8 || code === 9 || code === 10 || code === 12 || code === 13) {
      pendingBytes += 2;
    } else if (code <= 31) {
      pendingBytes += 6;
    } else if (code >= 55296 && code <= 56319) {
      const next = value.charCodeAt(index2 + 1);
      if (next >= 56320 && next <= 57343) {
        pendingBytes += 4;
        index2 += 1;
      } else {
        pendingBytes += 6;
      }
    } else if (code >= 56320 && code <= 57343) {
      pendingBytes += 6;
    } else if (code <= 127) {
      pendingBytes += 1;
    } else if (code <= 2047) {
      pendingBytes += 2;
    } else {
      pendingBytes += 3;
    }
  }
  bytes.consume(pendingBytes);
}
function assertBoundedPackStructure(pack, budget) {
  const bytes = new ByteBudget("Pack validation input", budget.limits.mcpArgumentBytes);
  const active = /* @__PURE__ */ new WeakSet();
  const pending = [{ kind: "value", value: pack }];
  budget.work.consume();
  while (pending.length > 0) {
    budget.deadline.check();
    const entry = pending.pop();
    if (entry.kind === "leave") {
      active.delete(entry.value);
      continue;
    }
    const value = entry.value;
    if (typeof value === "string") {
      consumeJsonStringBytes(value, bytes, budget.deadline);
      continue;
    }
    if (value === null) {
      bytes.consume(4);
      continue;
    }
    if (typeof value === "number") {
      bytes.consume(Number.isFinite(value) ? Buffer.byteLength(String(value), "utf8") : 4);
      continue;
    }
    if (typeof value === "boolean") {
      bytes.consume(value ? 4 : 5);
      continue;
    }
    if (typeof value === "bigint") {
      throw new Error("Pack validation input must contain only JSON values");
    }
    if (typeof value !== "object") {
      bytes.consume(4);
      continue;
    }
    if (active.has(value)) throw new Error("Pack validation input must not contain circular references");
    active.add(value);
    if (Array.isArray(value)) {
      bytes.consume(2 + Math.max(0, value.length - 1));
      budget.work.consume(value.length);
      pending.push({ kind: "leave", value });
      for (let index2 = value.length - 1; index2 >= 0; index2 -= 1) {
        pending.push({ kind: "value", value: value[index2] });
      }
      continue;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("Pack validation input must contain only plain JSON objects and arrays");
    }
    const children = [];
    let propertyCount = 0;
    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      budget.deadline.check();
      budget.work.consume();
      if (propertyCount > 0) bytes.consume(1);
      consumeJsonStringBytes(key, bytes, budget.deadline);
      bytes.consume(1);
      children.push(value[key]);
      propertyCount += 1;
    }
    bytes.consume(2);
    pending.push({ kind: "leave", value });
    for (let index2 = children.length - 1; index2 >= 0; index2 -= 1) {
      pending.push({ kind: "value", value: children[index2] });
    }
  }
  budget.deadline.check();
}
function assertPackInputLimits(pack, budget) {
  const { limits, deadline } = budget;
  deadline.check();
  if (!pack || typeof pack !== "object" || Array.isArray(pack)) return;
  const candidate = pack;
  assertPackArrayLimit("Pack documents", candidate.documents, limits.pack.maxDocuments);
  assertPackArrayLimit("Pack records", candidate.records, limits.pack.maxRecords);
  const scope = candidate.scope;
  if (scope && typeof scope === "object" && !Array.isArray(scope)) {
    assertPackArrayLimit("Pack scope paths", scope.paths, limits.scan.maxFiles);
  }
  const sourceRevision = candidate.sourceRevision;
  const files = sourceRevision && typeof sourceRevision === "object" && !Array.isArray(sourceRevision) ? sourceRevision.files : void 0;
  if (files && typeof files === "object" && !Array.isArray(files)) {
    let count = 0;
    for (const _key in files) {
      deadline.check();
      count += 1;
      if (count > limits.scan.maxFiles) {
        throw new Error(`Pack source files exceeds the limit of ${limits.scan.maxFiles} items`);
      }
    }
  }
  const archive2 = candidate.archive;
  if (archive2 && typeof archive2 === "object" && !Array.isArray(archive2)) {
    assertPackArrayLimit("Pack archive generations", archive2.generations, 2);
  }
  assertPackArrayLimit("Pack dedupe exceptions", candidate.dedupeExceptions, limits.redundancy.maxDecisions);
  if (Array.isArray(candidate.records)) {
    for (const record of candidate.records) {
      deadline.check();
      if (!record || typeof record !== "object" || Array.isArray(record)) continue;
      const typed = record;
      assertPackArrayLimit("Pack record evidence", typed.evidence, limits.pack.maxEvidencePerRecord);
      assertPackArrayLimit("Pack record impact", typed.impact, limits.pack.maxImpactPerRecord);
      const lifecycle = typed.lifecycle;
      if (lifecycle && typeof lifecycle === "object" && !Array.isArray(lifecycle)) {
        assertPackArrayLimit(
          "Pack record successors",
          lifecycle.successorIds,
          Math.min(limits.pack.maxRecords, limits.scan.maxEvidence)
        );
      }
    }
  }
  assertBoundedPackStructure(pack, budget);
}
function managedBlocks(markdown, onMatch = () => void 0) {
  const blocks = [];
  const expression = /<!-- project-design-keeper:managed record-id="([A-Za-z0-9][A-Za-z0-9._:-]*)" content-hash="(sha256:[a-f0-9]{64})" -->([\s\S]*?)<!-- \/project-design-keeper:managed -->/gu;
  let match;
  while ((match = expression.exec(markdown)) !== null) {
    onMatch();
    blocks.push({ id: match[1], declaredHash: match[2], content: match[3] });
  }
  return blocks;
}
function derivedBlocks(markdown, onMatch = () => void 0) {
  const blocks = [];
  const expression = /<!-- project-design-keeper:derived document-id="([A-Za-z0-9][A-Za-z0-9._:-]*)" content-hash="(sha256:[a-f0-9]{64})" -->([\s\S]*?)<!-- \/project-design-keeper:derived -->/gu;
  let match;
  while ((match = expression.exec(markdown)) !== null) {
    onMatch();
    blocks.push({ id: match[1], declaredHash: match[2], content: match[3] });
  }
  return blocks;
}
function markdownLinks(markdown, onMatch = () => void 0) {
  const links = [];
  const expression = /!?\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+["'][^"']*["'])?\s*\)/gu;
  let match;
  while ((match = expression.exec(markdown)) !== null) {
    onMatch();
    links.push(match[1]);
  }
  return links;
}
function currentKnowledgeMarkdown(markdown, terminalRecordIds) {
  return markdown.replace(
    /<!-- project-design-keeper:managed record-id="([A-Za-z0-9][A-Za-z0-9._:-]*)" content-hash="sha256:[a-f0-9]{64}" -->([\s\S]*?)<!-- \/project-design-keeper:managed -->/gu,
    (block, recordId) => terminalRecordIds.has(recordId) ? "" : block
  );
}
function normalizedStatement(statement) {
  return statement.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[\p{P}\p{S}\s]+/gu, "");
}
function createPackValidationBudget(options) {
  const limits = resolveKeeperLimits(options.limits);
  const externalBudget = options.resourceBudget;
  if (externalBudget && (!Number.isSafeInteger(externalBudget.maxFileBytes) || externalBudget.maxFileBytes < 0)) {
    throw new Error("Pack validation shared file byte limit must be a non-negative integer");
  }
  const localDeadline = new DeadlineBudget("Pack validation", limits.scan.deadlineMs);
  const localAnalysisBytes = new ByteBudget("Pack validation analysis bytes", limits.scan.maxAggregateBytes);
  const localWork = new CounterBudget("Pack validation work", limits.scan.maxEvidence);
  const localManagedEntries = new CounterBudget(
    "Pack validation managed-tree entries",
    Math.min(limits.scan.maxFiles, packValidationManagedTreeMaximumEntries)
  );
  return {
    limits,
    maxFileBytes: Math.min(limits.scan.maxFileBytes, externalBudget?.maxFileBytes ?? limits.scan.maxFileBytes),
    files: new CounterBudget("Pack validation files", limits.scan.maxFiles),
    bytes: new ByteBudget("Pack validation aggregate bytes", limits.scan.maxAggregateBytes),
    ...externalBudget ? {
      externalFiles: externalBudget.files,
      externalBytes: externalBudget.bytes,
      ...externalBudget.accountedFiles ? { externalAccountedFiles: externalBudget.accountedFiles } : {}
    } : {},
    analysisBytes: externalBudget?.analysisBytes ? {
      consume: (bytes) => {
        localAnalysisBytes.consume(bytes);
        externalBudget.analysisBytes.consume(bytes);
      }
    } : localAnalysisBytes,
    work: externalBudget?.work ? {
      consume: (items = 1) => {
        localWork.consume(items);
        externalBudget.work.consume(items);
      }
    } : localWork,
    managedEntries: externalBudget?.managedEntries ? {
      consume: (items = 1) => {
        localManagedEntries.consume(items);
        externalBudget.managedEntries.consume(items);
      }
    } : localManagedEntries,
    deadline: externalBudget ? {
      check: () => {
        localDeadline.check();
        externalBudget.deadline.check();
      }
    } : localDeadline
  };
}
function assertPackValidationInputBounds(pack, options = {}) {
  const budget = createPackValidationBudget(options);
  assertPackInputLimits(pack, budget);
  budget.deadline.check();
}
async function validatePack(input, options = {}) {
  const budget = createPackValidationBudget(options);
  const { limits } = budget;
  const pack = input.pack;
  assertPackInputLimits(pack, budget);
  budget.deadline.check();
  const schemaResult = canonicalPackSchema.safeParse(pack);
  budget.deadline.check();
  if (!schemaResult.success) {
    return {
      valid: false,
      errors: schemaResult.error.issues.map((issue) => validationDiagnostic(
        "schema_invalid",
        issue.path.join(".") || "pack",
        issue.message
      )),
      warnings: []
    };
  }
  const canonicalPack = schemaResult.data;
  const aliasErrors = repositoryPathAliasDiagnostics(canonicalPack, options.overlay, () => {
    budget.deadline.check();
    budget.work.consume();
    budget.deadline.check();
  });
  if (aliasErrors.length > 0) return { valid: false, errors: aliasErrors, warnings: [] };
  if (typeof input.root !== "string") {
    return { valid: false, errors: [validationDiagnostic("root_required", "root", "A repository root is required")], warnings: [] };
  }
  let root;
  let rootIdentity;
  try {
    root = await realpath(resolve(input.root));
    rootIdentity = await lstat(root, { bigint: true });
    if (rootIdentity.isSymbolicLink() || !rootIdentity.isDirectory()) throw new Error("root is not a directory");
  } catch {
    return { valid: false, errors: [validationDiagnostic("root_invalid", "root", "The repository root cannot be resolved")], warnings: [] };
  }
  const overlay = /* @__PURE__ */ new Map();
  const overlayPaths = /* @__PURE__ */ new Map();
  const preaccountedOverlay = new Set(
    [...options.preaccountedOverlay ?? []].map(windowsRepositoryPathKey)
  );
  const accountedFiles = /* @__PURE__ */ new Set();
  const accountFile = (key) => {
    if (accountedFiles.has(key)) return;
    budget.files.consume();
    accountedFiles.add(key);
    if (!budget.externalFiles) return;
    if (budget.externalAccountedFiles?.has(key)) return;
    budget.externalFiles.consume();
    budget.externalAccountedFiles?.add(key);
  };
  for (const [path, contents] of options.overlay ?? []) {
    budget.deadline.check();
    if (!safeRepositoryPath(path, true)) {
      return {
        valid: false,
        errors: [validationDiagnostic("overlay_path_invalid", "overlay", "Candidate overlay contains an unsafe managed path")],
        warnings: []
      };
    }
    const key = windowsRepositoryPathKey(path);
    accountFile(key);
    if (contents !== void 0) {
      if (contents.byteLength > budget.maxFileBytes) {
        throw new Error(`Pack validation file ${path} exceeds the limit of ${budget.maxFileBytes} bytes`);
      }
      budget.bytes.consume(contents.byteLength);
      if (!preaccountedOverlay.has(key)) budget.externalBytes?.consume(contents.byteLength);
    }
    overlay.set(key, contents === void 0 ? void 0 : Buffer.from(contents));
    overlayPaths.set(key, path);
  }
  const finalPathEvidence = /* @__PURE__ */ new Map();
  const finalEvidenceKey = (path) => {
    const normalized3 = resolve(path);
    return process.platform === "win32" ? normalized3.toLocaleLowerCase("en-US") : normalized3;
  };
  const rememberFinalEvidence = (evidence) => {
    const key = finalEvidenceKey(evidence.lexical);
    if (!finalPathEvidence.has(key)) finalPathEvidence.set(key, evidence);
  };
  const projectFiles = /* @__PURE__ */ new Map();
  const validationFileDependencies = /* @__PURE__ */ new Map();
  const validationPathStates = /* @__PURE__ */ new Map();
  const contentHash = (contents) => `sha256:${createHash("sha256").update(contents).digest("hex")}`;
  const rememberFileDependency = (path, contents) => {
    validationFileDependencies.set(path, contents === void 0 ? null : contentHash(contents));
  };
  const rememberPathState = (path, metadata, canonical2) => {
    const canonicalRelative = relative(root, canonical2).replaceAll(sep, "/");
    const kind = metadata.isFile() ? "file" : metadata.isDirectory() ? "directory" : "other";
    validationPathStates.set(path, `${kind}:${canonicalRelative}`);
  };
  const consumeWork = (items = 1) => {
    budget.deadline.check();
    budget.work.consume(items);
    budget.deadline.check();
  };
  const fileText = (view) => {
    if (view.kind !== "regular" || !view.contents) throw new Error("Pack validation file text requires a regular file");
    if (view.text === void 0) {
      budget.deadline.check();
      budget.analysisBytes.consume(view.contents.byteLength);
      view.text = view.contents.toString("utf8");
      budget.deadline.check();
    }
    return view.text;
  };
  const fileLines = (view) => {
    if (view.lines !== void 0) return view.lines;
    const text = fileText(view);
    const lines = [];
    let start = 0;
    for (let index2 = 0; index2 < text.length; index2 += 1) {
      if ((index2 & 16383) === 0) budget.deadline.check();
      if (text.charCodeAt(index2) !== 10) continue;
      consumeWork();
      const end = index2 > start && text.charCodeAt(index2 - 1) === 13 ? index2 - 1 : index2;
      lines.push(text.slice(start, end));
      start = index2 + 1;
    }
    consumeWork();
    lines.push(text.slice(start));
    view.lines = lines;
    return view.lines;
  };
  const assertRootIdentity = async () => {
    budget.deadline.check();
    const current = await optionalMetadata(root);
    if (!current || !sameDirectoryVersion(rootIdentity, current)) {
      throw new Error("Pack validation repository root identity changed during validation");
    }
    budget.deadline.check();
  };
  const assertFinalPathEvidence = async () => {
    for (const evidence of finalPathEvidence.values()) {
      consumeWork();
      const current = await optionalMetadata(evidence.lexical);
      if (evidence.kind === "missing") {
        if (current) throw new Error(`Pack validation ${evidence.label} identity changed after validation`);
        continue;
      }
      const stable = Boolean(current && evidence.metadata) && (evidence.kind === "file" ? sameFileVersion(evidence.metadata, current) : evidence.kind === "directory" ? sameDirectoryVersion(evidence.metadata, current) : samePathVersion(evidence.metadata, current));
      if (!stable) throw new Error(`Pack validation ${evidence.label} identity changed after validation`);
      if (evidence.canonical !== void 0) {
        let currentCanonical;
        try {
          currentCanonical = await realpath(evidence.lexical);
        } catch {
          currentCanonical = null;
        }
        if (evidence.canonical === null && currentCanonical !== null || evidence.canonical !== null && (currentCanonical === null || !sameResolvedPath(evidence.canonical, currentCanonical))) {
          throw new Error(`Pack validation ${evidence.label} identity changed after validation`);
        }
      }
      budget.deadline.check();
    }
  };
  async function loadProjectFile(path) {
    budget.deadline.check();
    const lexical = resolve(root, ...path.split("/"));
    if (!isInsideRoot(root, lexical)) return { kind: "unsafe", lexical, unsafeReason: "outside-root" };
    const key = windowsRepositoryPathKey(path);
    if (overlay.has(key)) {
      const contents = overlay.get(key);
      rememberFileDependency(path, contents);
      if (contents === void 0) return { kind: "missing", lexical };
      return { kind: "regular", lexical, canonical: lexical, contents };
    }
    const metadata = await optionalMetadata(lexical);
    if (!metadata) {
      rememberFileDependency(path, void 0);
      rememberFinalEvidence({ label: `file ${path}`, lexical, kind: "missing" });
      return { kind: "missing", lexical };
    }
    if (metadata.isSymbolicLink() || !metadata.isFile() || metadata.nlink !== 1n) {
      rememberFinalEvidence({ label: `file ${path}`, lexical, kind: "path", metadata });
      return { kind: "unsafe", lexical, unsafeReason: "not-regular" };
    }
    const size = Number(metadata.size);
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error(`Pack validation file ${path} has an invalid byte length`);
    }
    if (size > budget.maxFileBytes) {
      throw new Error(`Pack validation file ${path} exceeds the limit of ${budget.maxFileBytes} bytes`);
    }
    let canonical2;
    try {
      canonical2 = await realpath(lexical);
    } catch {
      rememberFileDependency(path, void 0);
      rememberFinalEvidence({ label: `file ${path}`, lexical, kind: "file", metadata, canonical: null });
      return { kind: "missing", lexical };
    }
    if (!isInsideRoot(root, canonical2) || !sameResolvedPath(canonical2, lexical)) {
      rememberFinalEvidence({ label: `file ${path}`, lexical, kind: "file", metadata, canonical: canonical2 });
      return { kind: "unsafe", lexical, canonical: canonical2, unsafeReason: "outside-root" };
    }
    budget.bytes.consume(size);
    budget.externalBytes?.consume(size);
    await assertRootIdentity();
    budget.deadline.check();
    const handle = await open(lexical, "r");
    try {
      const opened = await handle.stat({ bigint: true });
      if (!sameFileVersion(metadata, opened)) {
        throw new Error(`Pack validation file ${path} identity changed before bounded read`);
      }
      await options.io?.afterProjectFileOpen?.(path);
      budget.deadline.check();
      const contents = Buffer.allocUnsafe(size);
      let offset = 0;
      while (offset < size) {
        budget.deadline.check();
        const result = await handle.read(contents, offset, size - offset, offset);
        if (result.bytesRead === 0) {
          throw new Error(`Pack validation file ${path} ended during bounded read`);
        }
        offset += result.bytesRead;
      }
      const overflow = Buffer.allocUnsafe(1);
      if ((await handle.read(overflow, 0, 1, size)).bytesRead !== 0) {
        throw new Error(`Pack validation file ${path} exceeded its validated byte length during bounded read`);
      }
      await options.io?.beforeProjectFileFinalIdentityCheck?.(path);
      budget.deadline.check();
      const finalHandle = await handle.stat({ bigint: true });
      const finalPath = await optionalMetadata(lexical);
      let finalCanonical;
      try {
        finalCanonical = await realpath(lexical);
      } catch {
        finalCanonical = void 0;
      }
      if (!sameFileVersion(opened, finalHandle) || !finalPath || !sameFileVersion(opened, finalPath) || finalCanonical === void 0 || !sameResolvedPath(finalCanonical, canonical2) || !isInsideRoot(root, finalCanonical)) {
        throw new Error(`Pack validation file ${path} identity changed during bounded read`);
      }
      await assertRootIdentity();
      rememberFinalEvidence({ label: `file ${path}`, lexical, kind: "file", metadata: finalHandle, canonical: canonical2 });
      rememberFileDependency(path, contents);
      return { kind: "regular", lexical, canonical: canonical2, contents };
    } finally {
      await handle.close();
    }
  }
  function projectFile(path) {
    const key = windowsRepositoryPathKey(path);
    const existing = projectFiles.get(key);
    if (existing) return existing;
    accountFile(key);
    const capture = loadProjectFile(path);
    projectFiles.set(key, capture);
    return capture;
  }
  const terminalRecordIds = new Set(canonicalPack.records.filter((record) => record.lifecycle?.state === "terminal").map((record) => record.id));
  const errors = [];
  const warnings = [];
  const freshnessChanged = /* @__PURE__ */ new Set();
  const freshnessDeleted = /* @__PURE__ */ new Set();
  const relocationCandidates = [];
  const recordAssessments = [];
  const mappedRecordIds = /* @__PURE__ */ new Set();
  const managedBlockLocations = /* @__PURE__ */ new Map();
  const managedBlockOwners = /* @__PURE__ */ new Map();
  const documentKeys = /* @__PURE__ */ new Map();
  const declaredDocumentKeys = new Set(canonicalPack.documents.map((document) => windowsRepositoryPathKey(document.path)));
  const requiredPaths = canonicalPack.schemaVersion === "2.0" || canonicalPack.schemaVersion === "3.0" ? v2RequiredDocumentPaths : requiredDocumentPaths;
  for (const requiredPath of requiredPaths) {
    if (!declaredDocumentKeys.has(windowsRepositoryPathKey(requiredPath))) {
      errors.push(validationDiagnostic("required_document_missing", "documents", `Required document is not mapped: ${requiredPath}`));
    }
  }
  if (canonicalPack.schemaVersion === "3.0") {
    if (canonicalPack.maintenanceRevision === void 0) {
      errors.push(validationDiagnostic("maintenance_revision_required", "maintenanceRevision", "Schema 3.0 requires maintenanceRevision"));
    }
    if (!canonicalPack.archive) {
      errors.push(validationDiagnostic("archive_metadata_required", "archive", "Schema 3.0 requires archive metadata"));
    }
    if (!canonicalPack.dedupeExceptions) {
      errors.push(validationDiagnostic("dedupe_exceptions_required", "dedupeExceptions", "Schema 3.0 requires dedupe exceptions"));
    }
    if (canonicalPack.pendingSync === true || Array.isArray(canonicalPack.pendingDesignDecisions) && canonicalPack.pendingDesignDecisions.length > 0) {
      errors.push(validationDiagnostic("pending_knowledge_sync", "pendingSync", "The implementation has pending design knowledge that must be previewed, applied, and validated"));
    }
  }
  const finalMarkdown = /* @__PURE__ */ new Map();
  const registerFinalMarkdown = (path, diagnosticPath) => {
    const key = windowsRepositoryPathKey(path);
    const prior = finalMarkdown.get(key);
    if (prior !== void 0 && prior !== path) {
      errors.push(validationDiagnostic(
        "repository_path_alias",
        diagnosticPath,
        `Managed path ${path} aliases ${prior} under Windows path rules`
      ));
      return false;
    }
    finalMarkdown.set(key, path);
    return true;
  };
  const managedDirectory = resolve(root, "docs", "project-design");
  async function visit(directory, depth) {
    budget.deadline.check();
    await assertRootIdentity();
    if (depth > packValidationManagedTreeMaximumDepth) {
      throw new Error(
        `Pack validation managed-tree depth exceeds the limit of ${packValidationManagedTreeMaximumDepth} levels`
      );
    }
    const directoryMetadata = await optionalMetadata(directory);
    if (!directoryMetadata) {
      if (depth === 0) {
        rememberFinalEvidence({ label: "managed-tree directory", lexical: directory, kind: "missing" });
        return;
      }
      throw new Error("Pack validation managed-tree identity changed during bounded enumeration");
    }
    const relativeDirectory = relative(root, directory).replaceAll(sep, "/");
    if (directoryMetadata.isSymbolicLink() || !directoryMetadata.isDirectory()) {
      errors.push(validationDiagnostic("managed_document_not_regular", relativeDirectory, "Managed document tree contains a symbolic link or non-directory entry"));
      return;
    }
    let canonicalDirectory;
    try {
      canonicalDirectory = await realpath(directory);
    } catch {
      errors.push(validationDiagnostic("managed_document_not_regular", relativeDirectory, "Managed document directory cannot be resolved safely"));
      return;
    }
    if (!isInsideRoot(root, canonicalDirectory) || !sameResolvedPath(canonicalDirectory, directory)) {
      errors.push(validationDiagnostic("managed_document_not_regular", relativeDirectory, "Managed document directory resolves through a symbolic link or outside the repository"));
      return;
    }
    const childNames = [];
    const directoryHandle = await opendir(directory);
    for await (const entry of directoryHandle) {
      budget.deadline.check();
      budget.managedEntries.consume();
      consumeWork();
      childNames.push(entry.name);
    }
    const afterEnumeration = await optionalMetadata(directory);
    let afterEnumerationCanonical;
    try {
      afterEnumerationCanonical = await realpath(directory);
    } catch {
      afterEnumerationCanonical = void 0;
    }
    if (!afterEnumeration || !sameDirectoryVersion(directoryMetadata, afterEnumeration) || afterEnumerationCanonical === void 0 || !sameResolvedPath(afterEnumerationCanonical, canonicalDirectory)) {
      throw new Error("Pack validation managed-tree identity changed during bounded enumeration");
    }
    childNames.sort((left, right) => left.localeCompare(right, "en-US"));
    for (const name2 of childNames) {
      budget.deadline.check();
      const lexical = resolve(directory, name2);
      const relativePath = relative(root, lexical).replaceAll(sep, "/");
      await options.io?.beforeManagedDirectoryEntry?.(relativePath, depth);
      budget.deadline.check();
      const metadata = await optionalMetadata(lexical);
      if (!metadata) {
        throw new Error(`Pack validation managed-tree entry identity changed: ${relativePath}`);
      }
      if (metadata.isSymbolicLink()) {
        errors.push(validationDiagnostic("managed_document_not_regular", relativePath, "Managed document tree contains a symbolic link or unreadable entry"));
        continue;
      }
      if (metadata.isDirectory()) {
        if (relativePath.toLocaleLowerCase("en-US").endsWith(".md")) {
          errors.push(validationDiagnostic("managed_document_not_regular", relativePath, "Managed Markdown path is a directory, not a regular file"));
          continue;
        }
        await visit(lexical, depth + 1);
        continue;
      }
      if (!metadata.isFile() || metadata.nlink !== 1n) {
        errors.push(validationDiagnostic("managed_document_not_regular", relativePath, "Managed document tree contains a non-regular entry"));
        continue;
      }
      if (relativePath.toLocaleLowerCase("en-US").endsWith(".md")) {
        const canonicalFile = await realpath(lexical);
        const finalMetadata = await optionalMetadata(lexical);
        if (!isInsideRoot(root, canonicalFile) || !sameResolvedPath(canonicalFile, lexical) || !finalMetadata || !sameFileVersion(metadata, finalMetadata)) {
          errors.push(validationDiagnostic("managed_document_not_regular", relativePath, "Managed Markdown resolves through a symbolic link or outside the repository"));
        } else {
          rememberFinalEvidence({
            label: `managed-tree file ${relativePath}`,
            lexical,
            kind: "file",
            metadata: finalMetadata,
            canonical: canonicalFile
          });
          registerFinalMarkdown(relativePath, relativePath);
        }
      }
    }
    const finalDirectory = await optionalMetadata(directory);
    let finalDirectoryCanonical;
    try {
      finalDirectoryCanonical = await realpath(directory);
    } catch {
      finalDirectoryCanonical = void 0;
    }
    if (!finalDirectory || !sameDirectoryVersion(directoryMetadata, finalDirectory) || finalDirectoryCanonical === void 0 || !sameResolvedPath(finalDirectoryCanonical, canonicalDirectory)) {
      throw new Error("Pack validation managed-tree identity changed during bounded enumeration");
    }
    rememberFinalEvidence({
      label: `managed-tree directory ${relativeDirectory || "."}`,
      lexical: directory,
      kind: "directory",
      metadata: finalDirectory,
      canonical: finalDirectoryCanonical
    });
  }
  await visit(managedDirectory, 0);
  for (const [key, contents] of overlay) {
    consumeWork();
    if (!key.startsWith("docs/project-design/") || !key.endsWith(".md")) continue;
    const path = overlayPaths.get(key) ?? key;
    const prior = finalMarkdown.get(key);
    if (prior !== void 0 && prior !== path) {
      errors.push(validationDiagnostic(
        "repository_path_alias",
        "overlay",
        `Candidate overlay path ${path} aliases ${prior} under Windows path rules`
      ));
      continue;
    }
    if (contents === void 0) finalMarkdown.delete(key);
    else registerFinalMarkdown(path, "overlay");
  }
  for (const [key, path] of finalMarkdown) {
    consumeWork();
    if (!declaredDocumentKeys.has(key)) {
      errors.push(validationDiagnostic("document_unmapped", "documents", `Final managed Markdown is not mapped by the manifest: ${path}`));
    }
  }
  for (const [index2, document] of canonicalPack.documents.entries()) {
    consumeWork();
    const diagnosticPath = `documents.${index2}.path`;
    const key = document.path.toLocaleLowerCase("en-US");
    const prior = documentKeys.get(key);
    if (prior) errors.push(validationDiagnostic("document_path_duplicate", diagnosticPath, `Document path aliases ${prior}`));
    else documentKeys.set(key, document.path);
    const view = await projectFile(document.path);
    if (view.kind === "missing") {
      errors.push(validationDiagnostic("document_missing", diagnosticPath, `Document does not exist: ${document.path}`));
      continue;
    }
    if (view.kind === "unsafe") {
      errors.push(view.unsafeReason === "outside-root" ? validationDiagnostic("document_outside_root", diagnosticPath, "Document resolves outside the repository root") : validationDiagnostic("document_not_regular", diagnosticPath, "Document must be an ordinary regular file"));
      continue;
    }
    const realDocument = view.canonical;
    const markdown = fileText(view);
    const managed = managedBlocks(markdown, consumeWork);
    const derived = derivedBlocks(markdown, consumeWork);
    const navigationDocument = document.path === "docs/project-design/index.md" || document.path === "docs/project-design/evidence-map.md" || canonicalPack.schemaVersion === "3.0" && document.path === "docs/project-design/archive/index.md";
    if (canonicalPack.schemaVersion === "3.0") {
      if (derived.length !== 1 || derived[0]?.id !== document.id || navigationDocument && managed.length > 0) {
        errors.push(validationDiagnostic("derived_document_invalid", diagnosticPath, `Schema 3.0 document must contain one derived header owned by ${document.id}${navigationDocument ? " and no managed records" : ""}`));
      }
    } else if (canonicalPack.schemaVersion === "2.0" && navigationDocument) {
      if (managed.length > 0 || derived.length !== 1 || derived[0]?.id !== document.id) {
        errors.push(validationDiagnostic("derived_document_invalid", diagnosticPath, `Navigation document must contain one derived block owned by ${document.id}`));
      }
    } else if (derived.length > 0) {
      errors.push(validationDiagnostic("derived_document_invalid", diagnosticPath, "Derived blocks are allowed only in schema 2.0 or 3.0 navigation documents"));
    }
    if (markdown.includes("project-design-keeper:derived") && derived.length === 0) {
      errors.push(validationDiagnostic("derived_document_invalid", diagnosticPath, "Derived document marker is malformed"));
    }
    for (const derivedBlock of derived) {
      consumeWork();
      const actualHash = `sha256:${createHash("sha256").update(derivedBlock.content, "utf8").digest("hex")}`;
      if (actualHash !== derivedBlock.declaredHash) {
        errors.push(validationDiagnostic("derived_block_hash_mismatch", diagnosticPath, `Derived block ${derivedBlock.id} content hash does not match its marker`));
      }
    }
    for (const managedBlock2 of managed) {
      consumeWork();
      mappedRecordIds.add(managedBlock2.id);
      managedBlockOwners.set(managedBlock2.id, document.id);
      const priorLocation = managedBlockLocations.get(managedBlock2.id);
      if (priorLocation) {
        errors.push(validationDiagnostic("managed_block_duplicate", diagnosticPath, `Managed block ${managedBlock2.id} also appears at ${priorLocation}`));
      } else {
        managedBlockLocations.set(managedBlock2.id, diagnosticPath);
      }
      const actualHash = `sha256:${createHash("sha256").update(managedBlock2.content, "utf8").digest("hex")}`;
      if (actualHash !== managedBlock2.declaredHash) {
        errors.push(validationDiagnostic(
          "managed_block_hash_mismatch",
          diagnosticPath,
          `Managed block ${managedBlock2.id} content hash does not match its marker`
        ));
      }
    }
    for (const link2 of markdownLinks(currentKnowledgeMarkdown(markdown, terminalRecordIds), consumeWork)) {
      if (win32.isAbsolute(link2)) {
        errors.push(validationDiagnostic("markdown_link_outside_root", diagnosticPath, `Markdown link is an absolute local path: ${link2}`));
        continue;
      }
      if (link2.startsWith("#") || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(link2)) continue;
      const withoutFragment = link2.split(/[?#]/u, 1)[0];
      if (!withoutFragment) continue;
      let decoded;
      try {
        decoded = decodeURIComponent(withoutFragment);
      } catch {
        errors.push(validationDiagnostic("markdown_link_invalid", diagnosticPath, `Markdown link is not valid URI text: ${link2}`));
        continue;
      }
      const linked = resolve(dirname(realDocument), decoded.replaceAll("/", sep));
      if (!isInsideRoot(root, linked)) {
        errors.push(validationDiagnostic("markdown_link_outside_root", diagnosticPath, `Markdown link escapes the repository: ${link2}`));
        continue;
      }
      const linkedRelative = relative(root, linked).replaceAll(sep, "/");
      const linkedKey = windowsRepositoryPathKey(linkedRelative);
      accountFile(linkedKey);
      if (overlay.has(linkedKey)) {
        if (overlay.get(linkedKey) === void 0) {
          errors.push(validationDiagnostic("markdown_link_missing", diagnosticPath, `Markdown link target does not exist: ${link2}`));
        } else {
          validationPathStates.set(linkedRelative, `file:${linkedRelative}`);
        }
        continue;
      }
      const linkedMetadata = await optionalMetadata(linked);
      if (!linkedMetadata) {
        rememberFinalEvidence({ label: `linked path ${linkedRelative}`, lexical: linked, kind: "missing" });
        errors.push(validationDiagnostic("markdown_link_missing", diagnosticPath, `Markdown link target does not exist: ${link2}`));
        continue;
      }
      const realLinked = await realpath(linked);
      const finalLinkedMetadata = await optionalMetadata(linked);
      let finalRealLinked;
      try {
        finalRealLinked = await realpath(linked);
      } catch {
        finalRealLinked = void 0;
      }
      if (!isInsideRoot(root, realLinked) || linkedMetadata.isSymbolicLink()) {
        errors.push(validationDiagnostic("markdown_link_outside_root", diagnosticPath, `Markdown link resolves outside the repository: ${link2}`));
      } else if (!finalLinkedMetadata || !samePathVersion(linkedMetadata, finalLinkedMetadata) || finalRealLinked === void 0 || !sameResolvedPath(realLinked, finalRealLinked)) {
        throw new Error(`Pack validation linked path identity changed during validation: ${linkedRelative}`);
      }
      if (finalLinkedMetadata && finalRealLinked !== void 0) {
        rememberPathState(linkedRelative, finalLinkedMetadata, finalRealLinked);
        rememberFinalEvidence({
          label: `linked path ${linkedRelative}`,
          lexical: linked,
          kind: "path",
          metadata: finalLinkedMetadata,
          canonical: finalRealLinked
        });
      }
    }
  }
  const statementIds = /* @__PURE__ */ new Map();
  const declaredRecordIds = new Set(canonicalPack.records.map((record) => record.id));
  for (const [managedId, diagnosticPath] of managedBlockLocations) {
    consumeWork();
    if (!declaredRecordIds.has(managedId)) {
      errors.push(validationDiagnostic("managed_block_unlisted", diagnosticPath, `Managed block is not listed in pack records: ${managedId}`));
    }
  }
  const relocationMatches = /* @__PURE__ */ new Map();
  const documentsById = new Map(canonicalPack.documents.map((document) => [document.id, document]));
  for (const [index2, record] of canonicalPack.records.entries()) {
    consumeWork();
    if (canonicalPack.schemaVersion === "2.0" || canonicalPack.schemaVersion === "3.0") {
      if (!record.kind) errors.push(validationDiagnostic("record_kind_required", `records.${index2}.kind`, `Schema ${canonicalPack.schemaVersion} record requires kind: ${record.id}`));
      if (!record.ownerDocument) {
        errors.push(validationDiagnostic("record_owner_required", `records.${index2}.ownerDocument`, `Schema 2.0 record requires ownerDocument: ${record.id}`));
      } else {
        const owner = documentsById.get(record.ownerDocument);
        if (!owner) {
          errors.push(validationDiagnostic("record_owner_missing", `records.${index2}.ownerDocument`, `Owning document is not declared: ${record.ownerDocument}`));
        } else {
          const expectedPath = {
            intent: "docs/project-design/intent.md",
            principle: "docs/project-design/principles.md",
            architecture: "docs/project-design/architecture.md",
            convention: "docs/project-design/conventions.md",
            decision: "docs/project-design/decisions.md",
            tuning: "docs/project-design/tuning.md",
            verification: "docs/project-design/verification.md",
            "open-question": "docs/project-design/open-questions.md"
          };
          const compatible = record.kind === "module" ? owner.path.startsWith("docs/project-design/modules/") && owner.path.endsWith(".md") : Boolean(record.kind && expectedPath[record.kind] === owner.path);
          if (!compatible) {
            errors.push(validationDiagnostic("record_owner_incompatible", `records.${index2}.ownerDocument`, `Record kind ${record.kind ?? "missing"} cannot be owned by ${owner.path}`));
          }
          if (managedBlockOwners.get(record.id) !== record.ownerDocument) {
            errors.push(validationDiagnostic("record_owner_mismatch", `records.${index2}.ownerDocument`, `Record ${record.id} is not rendered in its declared owning document`));
          }
        }
      }
    }
    if (canonicalPack.schemaVersion === "3.0") {
      if (!record.assertedConfidence) {
        errors.push(validationDiagnostic("record_asserted_confidence_required", `records.${index2}.assertedConfidence`, `Schema 3.0 record requires assertedConfidence: ${record.id}`));
      }
      if (!record.lifecycle) {
        errors.push(validationDiagnostic("record_lifecycle_required", `records.${index2}.lifecycle`, `Schema 3.0 record requires lifecycle: ${record.id}`));
      }
      if (record.confidence !== void 0) {
        errors.push(validationDiagnostic("record_legacy_confidence_forbidden", `records.${index2}.confidence`, `Schema 3.0 uses assertedConfidence instead of confidence: ${record.id}`));
      }
      if (record.statement !== record.statement.trim() || /\r|\n/u.test(record.statement)) {
        errors.push(validationDiagnostic("record_statement_non_atomic", `records.${index2}.statement`, `Schema 3.0 statements must be one trimmed atomic line: ${record.id}`));
      }
      if (record.assertedConfidence) {
        recordAssessments.push(assessRecord({
          id: record.id,
          kind: record.kind,
          approval: record.approval,
          assertedConfidence: record.assertedConfidence,
          evidence: record.evidence
        }));
      }
    }
    if (!mappedRecordIds.has(record.id)) {
      errors.push(validationDiagnostic("record_orphan", `records.${index2}.id`, `Record is not mapped by any declared document: ${record.id}`));
    }
    const normalized3 = normalizedStatement(record.statement);
    const prior = statementIds.get(normalized3);
    if (prior && prior !== record.id) {
      errors.push(validationDiagnostic("record_statement_duplicate", `records.${index2}.statement`, `Statement duplicates record ${prior}`));
    } else {
      statementIds.set(normalized3, record.id);
    }
    if (record.evidence.length === 0) {
      warnings.push(validationDiagnostic("record_evidence_empty", `records.${index2}.evidence`, `Record has no source evidence: ${record.id}`));
    }
    for (const [evidenceIndex, evidence] of record.evidence.entries()) {
      consumeWork();
      const evidencePath = `records.${index2}.evidence.${evidenceIndex}`;
      if (canonicalPack.schemaVersion === "3.0" && typeof evidence === "string") {
        errors.push(validationDiagnostic("record_evidence_typed_required", evidencePath, `Schema 3.0 evidence must be a typed object: ${record.id}`));
        continue;
      }
      const legacyMatch = typeof evidence === "string" ? /^(.*):([0-9]+)$/u.exec(evidence) : void 0;
      const sourcePath = typeof evidence === "string" ? legacyMatch?.[1] : evidence.path;
      const startLine = typeof evidence === "string" ? Number(legacyMatch?.[2]) : evidence.startLine;
      const endLine = typeof evidence === "string" ? startLine : evidence.endLine ?? evidence.startLine;
      if (!sourcePath || !safeRepositoryPath(sourcePath)) {
        errors.push(validationDiagnostic("evidence_path_invalid", evidencePath, "Evidence must use a safe repository path and one-based line"));
        continue;
      }
      if (!Number.isSafeInteger(startLine) || startLine < 1 || !Number.isSafeInteger(endLine) || endLine < startLine) {
        errors.push(validationDiagnostic("evidence_line_invalid", evidencePath, "Evidence lines must be one-based and ordered"));
        continue;
      }
      const sourceView = await projectFile(sourcePath);
      if (sourceView.kind === "missing") {
        errors.push(validationDiagnostic("evidence_source_missing", evidencePath, `Evidence source does not exist: ${sourcePath}`));
        continue;
      }
      if (sourceView.kind === "unsafe") {
        errors.push(validationDiagnostic("evidence_path_invalid", evidencePath, `Evidence source is not a safe in-repository file: ${sourcePath}`));
        continue;
      }
      const sourceLines = fileLines(sourceView);
      const lineCount = sourceLines.at(-1) === "" ? sourceLines.length - 1 : sourceLines.length;
      if (endLine > lineCount) {
        errors.push(validationDiagnostic("evidence_line_invalid", evidencePath, `Evidence line ${endLine} exceeds ${sourcePath}'s ${lineCount} lines`));
        continue;
      }
      if (typeof evidence !== "string") {
        const excerpt = sourceLines.slice(startLine - 1, endLine).join("\n");
        budget.analysisBytes.consume(Buffer.byteLength(excerpt, "utf8"));
        const excerptHash = `sha256:${createHash("sha256").update(excerpt, "utf8").digest("hex")}`;
        if (excerptHash !== evidence.excerptHash) {
          errors.push(validationDiagnostic("evidence_excerpt_hash_mismatch", `${evidencePath}.excerptHash`, `Evidence excerpt hash does not match repository text: ${sourcePath}:${startLine}`));
          const span = endLine - startLine + 1;
          const relocationKey = `${windowsRepositoryPathKey(sourcePath)}\0${span}\0${evidence.excerptHash}`;
          let matches = relocationMatches.get(relocationKey);
          if (!matches) {
            matches = [];
            for (let candidate = 1; candidate + span - 1 <= lineCount; candidate += 1) {
              consumeWork(span);
              const candidateText = sourceLines.slice(candidate - 1, candidate - 1 + span).join("\n");
              budget.analysisBytes.consume(Buffer.byteLength(candidateText, "utf8"));
              const candidateHash = `sha256:${createHash("sha256").update(candidateText, "utf8").digest("hex")}`;
              if (candidateHash === evidence.excerptHash) matches.push(candidate);
            }
            relocationMatches.set(relocationKey, matches);
          }
          if (matches.length === 1 && matches[0] !== startLine) {
            const relocatedEnd = matches[0] + span - 1;
            relocationCandidates.push({
              recordId: record.id,
              evidenceIndex,
              path: sourcePath,
              from: { startLine, ...endLine !== startLine ? { endLine } : {} },
              to: { startLine: matches[0], ...relocatedEnd !== matches[0] ? { endLine: relocatedEnd } : {} }
            });
          }
        }
      }
    }
  }
  if (canonicalPack.schemaVersion === "3.0") {
    const rawRecords = Array.isArray(pack.records) ? pack.records.filter((record) => Boolean(record) && typeof record === "object" && !Array.isArray(record)) : [];
    const byId = new Map(rawRecords.map((record) => [String(record.id), record]));
    const digestById = /* @__PURE__ */ new Map();
    const digest = (record) => {
      const id = String(record.id);
      const existing = digestById.get(id);
      if (existing) return existing;
      consumeWork();
      const value = `sha256:${createHash("sha256").update(JSON.stringify(record), "utf8").digest("hex")}`;
      digestById.set(id, value);
      return value;
    };
    for (const [index2, exception] of (canonicalPack.dedupeExceptions ?? []).entries()) {
      consumeWork();
      const left = byId.get(exception.leftId);
      const right = byId.get(exception.rightId);
      if (!left || !right || left.id === right.id || digest(left) !== exception.leftDigest || digest(right) !== exception.rightDigest) {
        errors.push(validationDiagnostic("dedupe_exception_invalidated", `dedupeExceptions.${index2}`, "Keep-separate exception IDs and content digests must match the current records"));
      }
    }
  }
  if (canonicalPack.schemaVersion === "3.0" && canonicalPack.archive) {
    const activeIds = new Set(canonicalPack.records.map((record) => record.id));
    const historicalIds = /* @__PURE__ */ new Set();
    if (canonicalPack.archive.generations.length > 2) {
      errors.push(validationDiagnostic("archive_generation_limit", "archive.generations", "Only the two newest full archive generations may be retained"));
    }
    for (const [generationIndex, generation] of canonicalPack.archive.generations.entries()) {
      consumeWork();
      const metadataPath = `archive.generations.${generationIndex}`;
      const expectedPath = `docs/project-design/archive/${generation.id}.records.jsonl`;
      if (generation.path !== expectedPath) {
        errors.push(validationDiagnostic("archive_generation_path_invalid", `${metadataPath}.path`, `Archive generation path must be ${expectedPath}`));
        continue;
      }
      const view = await projectFile(generation.path);
      if (view.kind !== "regular") {
        errors.push(validationDiagnostic("archive_generation_missing", `${metadataPath}.path`, `Archive generation is missing or unsafe: ${generation.path}`));
        continue;
      }
      let lines;
      try {
        lines = decodeCanonicalJsonLines(view.contents, `Archive generation ${generation.path}`, {
          expectedCount: generation.recordCount,
          maxBytes: Math.min(budget.maxFileBytes, keeperLimits.preview.maxFileBytes),
          maxLines: Math.min(limits.pack.maxRecords, limits.scan.maxEvidence)
        });
      } catch (error) {
        const count = error instanceof CanonicalJsonLinesError && error.kind === "count";
        errors.push(validationDiagnostic(
          count ? "archive_record_count_mismatch" : "archive_jsonl_invalid",
          count ? `${metadataPath}.recordCount` : generation.path,
          error instanceof Error ? error.message : "Archive generation JSONL is invalid"
        ));
        continue;
      }
      for (const { value, line } of lines) {
        consumeWork();
        const entry = value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
        const linePath = `${generation.path}:${line}`;
        if (!isCompleteArchiveEntry(entry)) {
          errors.push(validationDiagnostic("archive_record_invalid", linePath, "Archive line must contain only the complete Schema 3.0 archive record fields"));
        }
        const archivedRecord = entry?.record;
        if (!entry || !archivedRecord || typeof archivedRecord !== "object" || Array.isArray(archivedRecord)) {
          errors.push(validationDiagnostic("archive_record_invalid", linePath, "Archive line must contain a complete record object"));
          continue;
        }
        const record = archivedRecord;
        const lifecycle = record.lifecycle;
        const terminal = lifecycle && typeof lifecycle === "object" && !Array.isArray(lifecycle) ? lifecycle : void 0;
        const parsedRecord = knowledgeRecordSchema.safeParse(record);
        if (!parsedRecord.success || typeof record.kind !== "string" || typeof record.ownerDocument !== "string" || typeof record.assertedConfidence !== "string" || record.confidence !== void 0) {
          errors.push(validationDiagnostic("archive_record_invalid", linePath, "Archive line must retain a complete Schema 3.0 knowledge record"));
        }
        if (terminal?.state !== "terminal" || !Number.isSafeInteger(terminal.confirmedRefreshes) || Number(terminal.confirmedRefreshes) < 2) {
          errors.push(validationDiagnostic("archive_record_ineligible", linePath, "Archived record must be terminal for at least two confirmed refreshes"));
        }
        if (typeof record.id !== "string" || !stableId.safeParse(record.id).success) {
          errors.push(validationDiagnostic("archive_record_invalid", linePath, "Archived record must retain a stable ID"));
        } else if (activeIds.has(record.id) || historicalIds.has(record.id)) {
          errors.push(validationDiagnostic("archive_record_duplicate", linePath, `Archived record ID is duplicated: ${record.id}`));
        } else {
          historicalIds.add(record.id);
        }
        for (const field of ["originalOwnerDocument", "managedBody", "contentHash", "evidenceHash", "archivedAt"]) {
          if (typeof entry[field] !== "string") errors.push(validationDiagnostic("archive_record_invalid", linePath, `Archive record is missing ${field}`));
        }
        if (typeof entry.managedBody === "string" && entry.contentHash !== `sha256:${createHash("sha256").update(entry.managedBody, "utf8").digest("hex")}`) {
          errors.push(validationDiagnostic("archive_record_content_hash_mismatch", linePath, "Archive contentHash must match managedBody bytes"));
        }
        if (entry.evidenceHash !== `sha256:${createHash("sha256").update(JSON.stringify(record.evidence), "utf8").digest("hex")}`) {
          errors.push(validationDiagnostic("archive_record_evidence_hash_mismatch", linePath, "Archive evidenceHash must match the archived record evidence"));
        }
        if (entry.originalOwnerDocument !== record.ownerDocument) {
          errors.push(validationDiagnostic("archive_record_owner_mismatch", linePath, "Archive originalOwnerDocument must match the archived record owner"));
        }
        if (typeof entry.contentHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(entry.contentHash) || typeof entry.evidenceHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(entry.evidenceHash) || entry.terminalReason !== terminal?.reason || !Number.isSafeInteger(entry.maintenanceRevision) || Number.isNaN(Date.parse(String(entry.archivedAt)))) {
          errors.push(validationDiagnostic("archive_record_invalid", linePath, "Archive record hashes, terminal reason, revision, and timestamp must be complete and consistent"));
        }
      }
    }
    const tombstones = canonicalPack.archive.tombstones;
    if (tombstones.path !== "docs/project-design/archive/tombstones.jsonl") {
      errors.push(validationDiagnostic("tombstone_path_invalid", "archive.tombstones.path", "Tombstones must use docs/project-design/archive/tombstones.jsonl"));
    } else {
      const view = await projectFile(tombstones.path);
      if (view.kind === "missing" && tombstones.count !== 0) {
        errors.push(validationDiagnostic("tombstone_file_missing", "archive.tombstones.path", "Tombstone file is missing"));
      } else if (view.kind === "unsafe") {
        errors.push(validationDiagnostic("tombstone_file_unsafe", "archive.tombstones.path", "Tombstone file must be a safe regular file"));
      } else if (view.kind === "regular") {
        let lines;
        try {
          lines = decodeCanonicalJsonLines(view.contents, `History tombstone ${tombstones.path}`, {
            expectedCount: tombstones.count,
            maxBytes: Math.min(budget.maxFileBytes, keeperLimits.preview.maxFileBytes),
            maxLines: Math.min(limits.pack.maxRecords, limits.scan.maxEvidence)
          });
        } catch (error) {
          const count = error instanceof CanonicalJsonLinesError && error.kind === "count";
          errors.push(validationDiagnostic(
            count ? "tombstone_count_mismatch" : "tombstone_jsonl_invalid",
            count ? "archive.tombstones.count" : tombstones.path,
            error instanceof Error ? error.message : "Tombstone JSONL is invalid"
          ));
          lines = [];
        }
        for (const { value, line } of lines) {
          consumeWork();
          const parsedTombstone = tombstoneSchema.safeParse(value);
          const id = parsedTombstone.success ? parsedTombstone.data.id : void 0;
          if (!parsedTombstone.success) {
            errors.push(validationDiagnostic("tombstone_invalid", `${tombstones.path}:${line}`, "Tombstone must retain a stable ID, terminal relationship, content hash, and archive time"));
          } else if (activeIds.has(id) || historicalIds.has(id)) {
            errors.push(validationDiagnostic("archive_record_duplicate", `${tombstones.path}:${line}`, `Historical record ID is duplicated: ${id}`));
          } else {
            historicalIds.add(id);
          }
        }
      }
    }
  }
  for (const [scopeIndex, scopePath] of (canonicalPack.scope.paths ?? []).entries()) {
    consumeWork();
    accountFile(windowsRepositoryPathKey(scopePath));
    const target = resolve(root, ...scopePath.split("/"));
    const metadata = await optionalMetadata(target);
    if (!metadata) {
      rememberFinalEvidence({ label: `source scope ${scopePath}`, lexical: target, kind: "missing" });
      errors.push(validationDiagnostic("source_scope_missing", `scope.paths.${scopeIndex}`, `Source scope does not exist: ${scopePath}`));
      continue;
    }
    const canonicalTarget = await realpath(target);
    const finalMetadata = await optionalMetadata(target);
    let finalCanonicalTarget;
    try {
      finalCanonicalTarget = await realpath(target);
    } catch {
      finalCanonicalTarget = void 0;
    }
    if (metadata.isSymbolicLink() || !isInsideRoot(root, canonicalTarget) || !sameResolvedPath(canonicalTarget, target)) {
      errors.push(validationDiagnostic("source_scope_outside_root", `scope.paths.${scopeIndex}`, `Source scope resolves outside the repository: ${scopePath}`));
    } else if (!finalMetadata || !samePathVersion(metadata, finalMetadata) || finalCanonicalTarget === void 0 || !sameResolvedPath(canonicalTarget, finalCanonicalTarget)) {
      throw new Error(`Pack validation source scope identity changed during validation: ${scopePath}`);
    }
    if (finalMetadata && finalCanonicalTarget !== void 0) {
      rememberPathState(scopePath, finalMetadata, finalCanonicalTarget);
      rememberFinalEvidence({
        label: `source scope ${scopePath}`,
        lexical: target,
        kind: "path",
        metadata: finalMetadata,
        canonical: finalCanonicalTarget
      });
    }
  }
  for (const [sourcePath, declaredHash] of Object.entries(canonicalPack.sourceRevision.files)) {
    consumeWork();
    const sourceView = await projectFile(sourcePath);
    if (sourceView.kind === "missing") {
      freshnessDeleted.add(sourcePath);
      errors.push(validationDiagnostic("source_revision_missing", `sourceRevision.files.${sourcePath}`, `Source revision file does not exist: ${sourcePath}`));
    } else if (sourceView.kind === "unsafe") {
      errors.push(validationDiagnostic("source_revision_outside_root", `sourceRevision.files.${sourcePath}`, `Source revision is not a safe in-repository file: ${sourcePath}`));
    } else {
      const actualHash = `sha256:${createHash("sha256").update(sourceView.contents).digest("hex")}`;
      if (actualHash !== declaredHash) {
        freshnessChanged.add(sourcePath);
        errors.push(validationDiagnostic("source_revision_hash_mismatch", `sourceRevision.files.${sourcePath}`, `Source revision hash does not match repository bytes: ${sourcePath}`));
      }
    }
  }
  if (canonicalPack.schemaVersion === "3.0") {
    const revisionPaths = new Set(Object.keys(canonicalPack.sourceRevision.files).map(windowsRepositoryPathKey));
    for (const [recordIndex, record] of canonicalPack.records.entries()) {
      consumeWork();
      for (const [evidenceIndex, evidence] of record.evidence.entries()) {
        consumeWork();
        const path = typeof evidence === "string" ? /^(.*):([0-9]+)$/u.exec(evidence)?.[1] : evidence.path;
        if (path && !revisionPaths.has(windowsRepositoryPathKey(path))) {
          errors.push(validationDiagnostic(
            "evidence_source_revision_missing",
            `records.${recordIndex}.evidence.${evidenceIndex}.path`,
            `Evidence source is not bound to sourceRevision.files: ${path}`
          ));
        }
      }
    }
  }
  const stalePaths = new Set([...freshnessChanged, ...freshnessDeleted].map(windowsRepositoryPathKey));
  const invalidatedRecordIds = [];
  for (const record of canonicalPack.records) {
    consumeWork();
    let invalidated = false;
    for (const evidence of record.evidence) {
      consumeWork();
      const path = typeof evidence === "string" ? /^(.*):([0-9]+)$/u.exec(evidence)?.[1] : evidence.path;
      if (path && stalePaths.has(windowsRepositoryPathKey(path))) invalidated = true;
    }
    if (invalidated) invalidatedRecordIds.push(record.id);
  }
  await assertFinalPathEvidence();
  await assertRootIdentity();
  if (errors.length === 0 && options.onValidationDependencyDigest) {
    const dependencyHash = createHash("sha256");
    const updateField = (value) => {
      const text = value ?? "";
      dependencyHash.update(value === null ? "n" : "s");
      dependencyHash.update(String(Buffer.byteLength(text, "utf8")));
      dependencyHash.update(":");
      dependencyHash.update(text, "utf8");
      dependencyHash.update(";");
    };
    dependencyHash.update("files;");
    for (const [path, hash2] of [...validationFileDependencies.entries()].sort(([left], [right]) => left.localeCompare(right, "en-US"))) {
      consumeWork();
      updateField(path);
      updateField(hash2);
    }
    dependencyHash.update("managed-markdown;");
    for (const path of [...finalMarkdown.values()].sort((left, right) => left.localeCompare(right, "en-US"))) {
      consumeWork();
      updateField(path);
    }
    dependencyHash.update("path-states;");
    for (const [path, state] of [...validationPathStates.entries()].sort(([left], [right]) => left.localeCompare(right, "en-US"))) {
      consumeWork();
      updateField(path);
      updateField(state);
    }
    budget.deadline.check();
    options.onValidationDependencyDigest(`sha256:${dependencyHash.digest("hex")}`);
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    ...canonicalPack.schemaVersion === "3.0" ? { recordAssessments, relocationCandidates } : {},
    freshness: {
      status: stalePaths.size > 0 ? "stale" : "fresh",
      changedFiles: [...freshnessChanged].sort(),
      deletedFiles: [...freshnessDeleted].sort(),
      invalidatedRecordIds
    }
  };
}
var persistedChangeSchema = external_exports.union([
  external_exports.object({
    path: documentPath,
    content: external_exports.string(),
    previousHash: sha256Hash.nullable(),
    managedBlocks: external_exports.array(external_exports.union([
      external_exports.object({ recordId: stableId, content: external_exports.string(), expectedContentHash: sha256Hash.optional() }).strict(),
      external_exports.object({ recordId: stableId, delete: external_exports.literal(true), expectedContentHash: sha256Hash.optional() }).strict()
    ])).nonempty().optional()
  }).strict(),
  external_exports.object({ path: documentPath, delete: external_exports.literal(true), previousHash: sha256Hash }).strict()
]);
var expiredPersistedChangesetV1Schema = external_exports.object({
  version: external_exports.literal(1),
  changesetId: canonicalUuidSchema,
  root: external_exports.string().min(1),
  createdAt: external_exports.number().finite().int().nonnegative(),
  expiresAt: external_exports.number().finite().int().positive(),
  changes: external_exports.array(persistedChangeSchema).nonempty(),
  manifestHash: sha256Hash.nullable(),
  sourceScope: external_exports.object({ root: external_exports.string().min(1), path: external_exports.union([external_exports.literal("."), repositoryPath]).optional() }).strict(),
  sourcePaths: external_exports.array(repositoryPath).nonempty().optional(),
  sourceFiles: external_exports.record(repositoryPath, sha256Hash)
}).strict().superRefine((changeset, context) => {
  if (changeset.sourceScope.root !== changeset.root) {
    context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["sourceScope", "root"], message: "must equal the changeset root" });
  }
  if (changeset.expiresAt !== changeset.createdAt + changesetLifetimeMs) {
    context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["expiresAt"], message: "must be exactly thirty minutes after createdAt" });
  }
  const reportAliases = (paths, issuePath) => {
    const seen = /* @__PURE__ */ new Map();
    paths.forEach((path, index2) => {
      const key = windowsRepositoryPathKey(path);
      const previous = seen.get(key);
      if (previous !== void 0) {
        context.addIssue({
          code: external_exports.ZodIssueCode.custom,
          path: [...issuePath, index2],
          message: `duplicates or aliases ${previous} under Windows path rules`
        });
      } else {
        seen.set(key, path);
      }
    });
  };
  reportAliases(changeset.changes.map((change) => change.path), ["changes"]);
  reportAliases(Object.keys(changeset.sourceFiles), ["sourceFiles"]);
  if (changeset.sourcePaths) {
    reportAliases(changeset.sourcePaths, ["sourcePaths"]);
    const declared = [...changeset.sourcePaths].sort();
    const fingerprinted = Object.keys(changeset.sourceFiles).sort();
    if (declared.length !== fingerprinted.length || declared.some((path, index2) => path !== fingerprinted[index2])) {
      context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["sourcePaths"], message: "must exactly match sourceFiles keys" });
    }
  }
  changeset.changes.forEach((change, changeIndex) => {
    if (!("managedBlocks" in change) || !change.managedBlocks) return;
    const ids = change.managedBlocks.map((block) => block.recordId);
    ids.forEach((id, index2) => {
      if (ids.indexOf(id) !== index2) {
        context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["changes", changeIndex, "managedBlocks", index2], message: `duplicate managed block operation: ${id}` });
      }
    });
  });
});
var persistedChangesetSchema = external_exports.object({
  version: external_exports.literal(2),
  changesetId: canonicalUuidSchema,
  root: external_exports.string().min(1),
  createdAt: external_exports.number().finite().int().nonnegative(),
  expiresAt: external_exports.number().finite().int().positive(),
  diffDigest: diffDigestSchema,
  archiveActions: external_exports.object({
    archivedRecordIds: external_exports.array(stableId).max(1e4),
    tombstonedRecordIds: external_exports.array(stableId).max(1e4)
  }).strict(),
  semanticDecisionIds: external_exports.array(stableId).max(11e3),
  historyFiles: external_exports.record(documentPath, sha256Hash.nullable()),
  changes: external_exports.array(persistedChangeSchema).nonempty(),
  manifestHash: sha256Hash.nullable(),
  sourceScope: external_exports.object({ root: external_exports.string().min(1), path: external_exports.union([external_exports.literal("."), repositoryPath]).optional() }).strict(),
  sourcePaths: external_exports.array(repositoryPath).nonempty().optional(),
  sourceFiles: external_exports.record(repositoryPath, sha256Hash),
  validatedPack: canonicalPackSchema.optional(),
  validationDependencyDigest: diffDigestSchema.optional()
}).strict().superRefine((changeset, context) => {
  if (changeset.sourceScope.root !== changeset.root) {
    context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["sourceScope", "root"], message: "must equal the changeset root" });
  }
  if (changeset.expiresAt !== changeset.createdAt + changesetLifetimeMs) {
    context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["expiresAt"], message: "must be exactly thirty minutes after createdAt" });
  }
  const hasValidatedPack = changeset.validatedPack !== void 0;
  const hasValidationDependencyDigest = changeset.validationDependencyDigest !== void 0;
  if (hasValidatedPack !== hasValidationDependencyDigest || hasValidatedPack && !changeset.sourcePaths) {
    context.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["validationDependencyDigest"],
      message: "must accompany validatedPack and candidate-pack sourcePaths"
    });
  }
  const requireSortedUnique = (ids, path) => {
    const sorted = [...ids].sort();
    if (sorted.some((id, index2) => id !== ids[index2]) || new Set(sorted).size !== sorted.length) {
      context.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path,
        message: "must be sorted and unique"
      });
    }
  };
  requireSortedUnique(changeset.archiveActions.archivedRecordIds, ["archiveActions", "archivedRecordIds"]);
  requireSortedUnique(changeset.archiveActions.tombstonedRecordIds, ["archiveActions", "tombstonedRecordIds"]);
  const semanticDecisionIds2 = [...changeset.semanticDecisionIds].sort();
  if (semanticDecisionIds2.some((id, index2) => id !== changeset.semanticDecisionIds[index2]) || new Set(semanticDecisionIds2).size !== semanticDecisionIds2.length) {
    context.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["semanticDecisionIds"],
      message: "must be sorted and unique"
    });
  }
  const reportAliases = (paths, issuePath) => {
    const seen = /* @__PURE__ */ new Map();
    paths.forEach((path, index2) => {
      const key = windowsRepositoryPathKey(path);
      const previous = seen.get(key);
      if (previous !== void 0) {
        context.addIssue({
          code: external_exports.ZodIssueCode.custom,
          path: [...issuePath, index2],
          message: `duplicates or aliases ${previous} under Windows path rules`
        });
      } else {
        seen.set(key, path);
      }
    });
  };
  reportAliases(changeset.changes.map((change) => change.path), ["changes"]);
  reportAliases(Object.keys(changeset.historyFiles), ["historyFiles"]);
  if (Object.keys(changeset.historyFiles).length > 1024) {
    context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["historyFiles"], message: "must contain at most 1024 files" });
  }
  reportAliases(Object.keys(changeset.sourceFiles), ["sourceFiles"]);
  if (changeset.sourcePaths) {
    reportAliases(changeset.sourcePaths, ["sourcePaths"]);
    const declared = [...changeset.sourcePaths].sort();
    const fingerprinted = Object.keys(changeset.sourceFiles).sort();
    if (declared.length !== fingerprinted.length || declared.some((path, index2) => path !== fingerprinted[index2])) {
      context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["sourcePaths"], message: "must exactly match sourceFiles keys" });
    }
  }
  changeset.changes.forEach((change, changeIndex) => {
    if (!("managedBlocks" in change) || !change.managedBlocks) return;
    const ids = change.managedBlocks.map((block) => block.recordId);
    ids.forEach((id, index2) => {
      if (ids.indexOf(id) !== index2) {
        context.addIssue({ code: external_exports.ZodIssueCode.custom, path: ["changes", changeIndex, "managedBlocks", index2], message: `duplicate managed block operation: ${id}` });
      }
    });
  });
});

// src/security/cursor.ts
import { Buffer as Buffer2 } from "node:buffer";
import { createHmac, randomBytes as randomBytes2, timingSafeEqual } from "node:crypto";
import { readFile as readFile2 } from "node:fs/promises";
import { join as join2 } from "node:path";

// src/security/cache.ts
import { randomUUID } from "node:crypto";
import { chmod, link, lstat as lstat2, mkdir, open as open2, opendir as opendir2, readdir, realpath as realpath2, rename, rm, rmdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname as dirname2, isAbsolute as isAbsolute2, join, parse, relative as relative2, resolve as resolve2, sep as sep2 } from "node:path";
import { performance as performance2 } from "node:perf_hooks";

// src/security/publication-claim.ts
import { randomBytes } from "node:crypto";
var PUBLICATION_CLAIM_LEASE_MS = 3e4;
var exactOwnerKeys = [
  "createdAtMs",
  "expiresAtMs",
  "initializationName",
  "nonce",
  "pid",
  "publicationName",
  "targetName",
  "version"
];
var canonicalUuidV4 = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
var initializationNamePattern = new RegExp(`^\\.claim-${canonicalUuidV4}\\.tmp$`, "u");
var publicationNamePattern = new RegExp(`^\\.${canonicalUuidV4}\\.tmp$`, "u");
function invalidOwner() {
  throw new Error("Publication claim owner metadata is invalid");
}
function validTargetName(value) {
  return typeof value === "string" && value !== "" && value !== "." && value !== ".." && !/[\\/]/u.test(value);
}
function createPublicationClaimOwner(targetName, initializationName, publicationName, now = Date.now()) {
  if (!Number.isSafeInteger(now) || now < 0 || now > Number.MAX_SAFE_INTEGER - PUBLICATION_CLAIM_LEASE_MS) {
    throw new Error("Publication claim timestamp is invalid");
  }
  if (!validTargetName(targetName)) throw new Error("Publication claim target name is invalid");
  if (!initializationNamePattern.test(initializationName)) {
    throw new Error("Publication claim initialization name is invalid");
  }
  if (!publicationNamePattern.test(publicationName)) {
    throw new Error("Publication temporary name is invalid");
  }
  return {
    version: 1,
    pid: process.pid,
    nonce: randomBytes(16).toString("hex"),
    createdAtMs: now,
    expiresAtMs: now + PUBLICATION_CLAIM_LEASE_MS,
    targetName,
    initializationName,
    publicationName
  };
}
function parsePublicationClaimOwner(value, expectedTargetName) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidOwner();
  const record = value;
  const keys = Object.keys(record).sort((left, right) => left.localeCompare(right, "en-US"));
  if (keys.length !== exactOwnerKeys.length || keys.some((key, index2) => key !== exactOwnerKeys[index2])) invalidOwner();
  if (record.version !== 1 || !Number.isSafeInteger(record.pid) || Number(record.pid) <= 0 || Number(record.pid) > 2147483647 || typeof record.nonce !== "string" || !/^[a-f0-9]{32}$/u.test(record.nonce) || !Number.isSafeInteger(record.createdAtMs) || Number(record.createdAtMs) < 0 || !Number.isSafeInteger(record.expiresAtMs) || Number(record.expiresAtMs) - Number(record.createdAtMs) !== PUBLICATION_CLAIM_LEASE_MS || !validTargetName(record.targetName) || record.targetName !== expectedTargetName || typeof record.initializationName !== "string" || !initializationNamePattern.test(record.initializationName) || typeof record.publicationName !== "string" || !publicationNamePattern.test(record.publicationName)) invalidOwner();
  return {
    version: 1,
    pid: Number(record.pid),
    nonce: record.nonce,
    createdAtMs: Number(record.createdAtMs),
    expiresAtMs: Number(record.expiresAtMs),
    targetName: record.targetName,
    initializationName: record.initializationName,
    publicationName: record.publicationName
  };
}

// src/security/process-liveness.ts
function probeProcessLiveness(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid > 2147483647) return "ambiguous";
  if (pid === process.pid) return "alive";
  try {
    process.kill(pid, 0);
    return "alive";
  } catch (error) {
    const code = error.code;
    if (code === "ESRCH") return "dead";
    return "ambiguous";
  }
}

// src/security/cache.ts
var PUBLICATION_CLAIM_WAIT_MS = 3e4;
function resolveCacheDirectory(options = {}, environment = process.env, homeDirectory = homedir()) {
  if (options.cacheDirectory) return resolve2(options.cacheDirectory);
  if (environment.PLUGIN_DATA) return resolve2(environment.PLUGIN_DATA);
  if (environment.LOCALAPPDATA) return resolve2(environment.LOCALAPPDATA, "project-design-keeper");
  if (environment.XDG_CACHE_HOME) return resolve2(environment.XDG_CACHE_HOME, "project-design-keeper");
  return resolve2(homeDirectory, ".cache", "project-design-keeper");
}
function sameFilesystemPath(left, right) {
  const normalize = (value) => process.platform === "win32" ? resolve2(value).toLocaleLowerCase("en-US") : resolve2(value);
  return normalize(left) === normalize(right);
}
function isStrictlyInside(root, candidate) {
  const nested = relative2(root, candidate);
  return nested !== "" && nested !== ".." && !nested.startsWith(`..${sep2}`) && !isAbsolute2(nested);
}
function isInsideOrSame(root, candidate) {
  return sameFilesystemPath(root, candidate) || isStrictlyInside(root, candidate);
}
function pathComponents(path) {
  const absolute = resolve2(path);
  const root = parse(absolute).root;
  const parts = relative2(root, absolute).split(sep2).filter(Boolean);
  const paths = [root];
  for (const part of parts) paths.push(join(paths.at(-1), part));
  return paths;
}
async function optionalLstat(path) {
  try {
    return await lstat2(path, { bigint: true });
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
function isMissingPathError(error) {
  return error.code === "ENOENT" || /path component is missing|no such file|disappeared/i.test(String(error.message));
}
var windowsUnsupportedDirectorySyncCodes = /* @__PURE__ */ new Set(["EINVAL", "EISDIR", "ENOSYS", "ENOTSUP", "EPERM"]);
async function syncPublicationDirectory(directory, hooks = {}) {
  await hooks.beforeParentDirectoryOpen?.(directory);
  const handle = await open2(directory, "r");
  let outcome = "synced";
  try {
    try {
      await handle.sync();
    } catch (error) {
      const code = error.code;
      if (process.platform !== "win32" || !code || !windowsUnsupportedDirectorySyncCodes.has(code)) throw error;
      outcome = "unsupported";
    }
  } finally {
    await handle.close();
  }
  await hooks.afterParentDirectorySync?.(directory, outcome);
  return outcome;
}
async function syncPublishedTarget(layout, identity, expectedLinks, hooks) {
  const links = Number(expectedLinks);
  await hooks.beforeFinalTargetFileSync?.(identity.path, links);
  await validateSecurePathIdentity(layout, identity);
  const handle = await open2(identity.path, "r+");
  try {
    const before = await handle.stat({ bigint: true });
    if (!sameStatIdentity(identity, before)) throw new Error("Published cache file identity changed before final-target sync");
    assertSecureOwnerFileMetadata(before, identity.path, expectedLinks);
    await handle.sync();
    const after = await handle.stat({ bigint: true });
    if (!sameStatIdentity(identity, after)) throw new Error("Published cache file identity changed during final-target sync");
    assertSecureOwnerFileMetadata(after, identity.path, expectedLinks);
  } finally {
    await handle.close();
  }
  await validateSecurePathIdentity(layout, identity);
  const settled = await lstat2(identity.path, { bigint: true });
  if (!sameStatIdentity(identity, settled)) throw new Error("Published cache file identity changed after final-target sync");
  assertSecureOwnerFileMetadata(settled, identity.path, expectedLinks);
  await hooks.afterFinalTargetFileSync?.(identity.path, links);
}
async function validateOrdinaryPathComponents(path, leaf) {
  const components = pathComponents(path);
  for (const [index2, component] of components.entries()) {
    const metadata = await optionalLstat(component);
    const isLeaf = index2 === components.length - 1;
    if (!metadata) {
      if (isLeaf && leaf === "missing-ok") return;
      throw new Error(`Cache path component is missing: ${component}`);
    }
    if (metadata.isSymbolicLink()) {
      throw new Error(`Cache path contains a symbolic-link, junction, or reparse component: ${component}`);
    }
    if ((!isLeaf || leaf === "directory") && !metadata.isDirectory()) {
      throw new Error(`Cache path component is not a directory: ${component}`);
    }
    if (isLeaf && leaf !== "directory" && !metadata.isFile()) {
      throw new Error(`Cache path is not an ordinary regular file: ${component}`);
    }
    const canonical2 = await realpath2(component);
    if (!sameFilesystemPath(canonical2, component)) {
      throw new Error(`Cache path contains a symbolic-link, junction, or reparse component: ${component}`);
    }
  }
}
function assertOwner(metadata, path, kind) {
  if (process.platform !== "win32" && typeof process.getuid === "function" && metadata.uid !== BigInt(process.getuid())) {
    throw new Error(`Cache ${kind} ownership is not owner-only: ${path}`);
  }
}
function assertSameBigintIdentity(before, after, path) {
  if (before.dev !== after.dev || before.ino !== after.ino) throw new Error(`Cache path identity changed during permission repair: ${path}`);
}
async function enforceOwnerDirectoryMetadata(path) {
  let metadata = await lstat2(path, { bigint: true });
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error(`Cache path is not an ordinary directory: ${path}`);
  assertOwner(metadata, path, "directory");
  if (process.platform !== "win32" && (metadata.mode & 0o777n) !== 0o700n) {
    const original = metadata;
    await chmod(path, 448);
    metadata = await lstat2(path, { bigint: true });
    assertSameBigintIdentity(original, metadata, path);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error(`Cache path is not an ordinary directory: ${path}`);
    assertOwner(metadata, path, "directory");
    if ((metadata.mode & 0o777n) !== 0o700n) throw new Error(`Cache directory permissions are not owner-only: ${path}`);
  }
}
async function validateOwnerDirectoryMetadata(path) {
  const metadata = await lstat2(path, { bigint: true });
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error(`Cache path is not an ordinary directory: ${path}`);
  assertOwner(metadata, path, "directory");
  if (process.platform !== "win32" && (metadata.mode & 0o777n) !== 0o700n) throw new Error(`Cache directory permissions are not owner-only: ${path}`);
}
async function validateOwnerDirectory(path) {
  await validateOrdinaryPathComponents(path, "directory");
  await validateOwnerDirectoryMetadata(path);
}
var UnexpectedLinkCountError = class extends Error {
  constructor(metadata, path) {
    super(`Cache file has an unexpected hard-link count: ${path}`);
    this.metadata = metadata;
  }
};
function fileIdentity(path, parent, metadata) {
  return {
    path,
    parent: parent.path,
    dev: metadata.dev,
    ino: metadata.ino,
    kind: "file",
    parentDev: parent.dev,
    parentIno: parent.ino
  };
}
function assertSecureOwnerFileMetadata(metadata, path, expectedLinks) {
  if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error(`Cache path is not an ordinary regular file: ${path}`);
  assertOwner(metadata, path, "file");
  if (expectedLinks !== void 0 && metadata.nlink !== expectedLinks) {
    throw new Error(`Cache file has an unexpected hard-link count: ${path}`);
  }
  if (process.platform !== "win32" && (BigInt(metadata.mode) & 0o777n) !== 0o600n) {
    throw new Error(`Cache file permissions are not owner-only: ${path}`);
  }
}
async function validateOwnerFile(path, allowRepair, hooks = {}) {
  let metadata = await lstat2(path, { bigint: true });
  if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error(`Cache path is not an ordinary regular file: ${path}`);
  assertOwner(metadata, path, "file");
  if (metadata.nlink !== 1n) throw new UnexpectedLinkCountError(metadata, path);
  if (process.platform !== "win32") {
    if ((metadata.mode & 0o777n) !== 0o600n) {
      if (!allowRepair) throw new Error(`Cache file permissions are not owner-only: ${path}`);
      const parent = await capturePathIdentity(dirname2(path), "directory");
      const originalIdentity = fileIdentity(path, parent, metadata);
      await hooks.beforeFileModeRepair?.(path, originalIdentity);
      const immediatelyBefore = await lstat2(path, { bigint: true });
      assertSameBigintIdentity(metadata, immediatelyBefore, path);
      if (immediatelyBefore.isSymbolicLink() || !immediatelyBefore.isFile()) throw new Error(`Cache path is not an ordinary regular file: ${path}`);
      assertOwner(immediatelyBefore, path, "file");
      if (immediatelyBefore.nlink !== 1n) throw new UnexpectedLinkCountError(immediatelyBefore, path);
      await chmod(path, 384);
      metadata = await lstat2(path, { bigint: true });
      assertSameBigintIdentity(immediatelyBefore, metadata, path);
      if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error(`Cache path is not an ordinary regular file: ${path}`);
      assertOwner(metadata, path, "file");
      if ((metadata.mode & 0o777n) !== 0o600n) throw new Error(`Cache file permissions are not owner-only: ${path}`);
      if (metadata.nlink !== 1n) throw new UnexpectedLinkCountError(metadata, path);
    }
  }
}
async function createSecureDirectory(path) {
  for (const component of pathComponents(path)) {
    let metadata = await optionalLstat(component);
    if (!metadata) {
      try {
        await mkdir(component, { mode: 448 });
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
      metadata = await lstat2(component, { bigint: true });
    }
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error(`Cache path contains a symbolic-link, junction, reparse, or non-directory component: ${component}`);
    }
    const canonical2 = await realpath2(component);
    if (!sameFilesystemPath(canonical2, component)) {
      throw new Error(`Cache path contains a symbolic-link, junction, or reparse component: ${component}`);
    }
  }
  await enforceOwnerDirectoryMetadata(path);
}
async function validateCacheDirectoryChain(root, target) {
  if (!isInsideOrSame(root, target)) throw new Error("Cache directory chain escapes the cache root");
  let current = root;
  await validateOwnerDirectoryMetadata(current);
  const nested = relative2(root, target);
  if (!nested) return;
  for (const part of nested.split(sep2).filter(Boolean)) {
    current = join(current, part);
    await validateOwnerDirectoryMetadata(current);
  }
}
async function enforceCacheDirectoryChain(root, target) {
  if (!isInsideOrSame(root, target)) throw new Error("Cache directory chain escapes the cache root");
  let current = root;
  await enforceOwnerDirectoryMetadata(current);
  const nested = relative2(root, target);
  if (!nested) return;
  for (const part of nested.split(sep2).filter(Boolean)) {
    current = join(current, part);
    await enforceOwnerDirectoryMetadata(current);
  }
}
function assertCacheChild(layout, path, kind) {
  const target = resolve2(path);
  if (!isStrictlyInside(layout.root, target)) throw new Error(`Cache ${kind} path escapes the cache root`);
  return target;
}
async function createSecureCacheDirectory(layout, path) {
  const target = assertCacheChild(layout, path, "directory");
  await createSecureDirectory(target);
  await enforceCacheDirectoryChain(layout.root, target);
  const canonical2 = await realpath2(target);
  if (!isStrictlyInside(layout.root, canonical2) || !sameFilesystemPath(canonical2, target)) {
    throw new Error("Cache directory resolves outside the cache root through a symbolic-link, junction, or reparse component");
  }
  return canonical2;
}
async function prepareSecureCache(options = {}, projectRoot) {
  const root = resolveCacheDirectory(
    options,
    options.environment ?? process.env,
    options.homeDirectory ?? homedir()
  );
  const lexicalProject = projectRoot === void 0 ? void 0 : resolve2(projectRoot);
  const project = lexicalProject === void 0 ? void 0 : await realpath2(lexicalProject);
  if (lexicalProject && (sameFilesystemPath(lexicalProject, root) || isStrictlyInside(lexicalProject, root) || isStrictlyInside(root, lexicalProject))) {
    throw new Error("Cache and project roots must be disjoint; neither may contain the other");
  }
  if (lexicalProject && project && !sameFilesystemPath(lexicalProject, project)) {
    throw new Error("Project root must use its canonical path; symbolic-link, junction, reparse, or alias roots are not allowed");
  }
  await createSecureDirectory(root);
  const canonicalRoot = await realpath2(root);
  if (project && (sameFilesystemPath(project, canonicalRoot) || isStrictlyInside(project, canonicalRoot) || isStrictlyInside(canonicalRoot, project))) {
    throw new Error("Cache and project roots must be disjoint; neither may contain the other");
  }
  const layout = {
    root: canonicalRoot,
    changesets: join(canonicalRoot, "changesets"),
    snapshots: join(canonicalRoot, "snapshots"),
    indexes: join(canonicalRoot, "indexes"),
    locks: join(canonicalRoot, "locks")
  };
  await Promise.all([
    createSecureDirectory(layout.changesets),
    createSecureDirectory(layout.snapshots),
    createSecureDirectory(layout.indexes),
    createSecureDirectory(layout.locks)
  ]);
  await validateCacheFile(layout, join(layout.root, "changeset-hmac.key"), true);
  return layout;
}
function publicationClaimPath(target) {
  return join(dirname2(target), `.publish-${basename(target)}`);
}
var maximumPublicationClaimOwnerBytes = 4 * 1024;
function sameStatIdentity(identity, metadata) {
  return identity.dev === metadata.dev && identity.ino === metadata.ino;
}
function samePublicationClaimFileVersion(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.gid === right.gid && left.mode === right.mode && left.nlink === right.nlink && left.size === right.size && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs && left.isFile() && right.isFile() && !left.isSymbolicLink() && !right.isSymbolicLink();
}
function samePublicationClaimFileExceptSettlement(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.gid === right.gid && left.mode === right.mode && left.size === right.size && left.mtimeNs === right.mtimeNs && left.isFile() && right.isFile() && !left.isSymbolicLink() && !right.isSymbolicLink();
}
function isPublicationClaimSettlementTransition(left, right) {
  return (left.nlink === 1n || left.nlink === 2n) && (right.nlink === 1n || right.nlink === 2n) && samePublicationClaimFileExceptSettlement(left, right);
}
var PublicationClaimInitializationSettled = class extends Error {
  constructor(claim) {
    super("Publication claim initialization metadata is settling");
    this.claim = claim;
  }
};
async function targetConvergedToOneLink(target, identity) {
  const settled = await lstat2(target, { bigint: true });
  if (!sameStatIdentity(identity, settled) || settled.nlink !== 1n) return false;
  assertSecureOwnerFileMetadata(settled, target, 1n);
  return true;
}
async function validateOwnedPublicationWindow(layout, target, targetMetadata, expectedClaim, hooks = {}) {
  if (targetMetadata.isSymbolicLink() || !targetMetadata.isFile() || targetMetadata.nlink !== 2n) {
    throw new Error(`Cache file has an unexpected hard-link count: ${target}`);
  }
  assertSecureOwnerFileMetadata(targetMetadata, target, 2n);
  const parent = await capturePathIdentity(dirname2(target), "directory");
  const targetIdentity = fileIdentity(target, parent, targetMetadata);
  let claim;
  try {
    claim = await capturePublicationClaim(layout, target);
  } catch (error) {
    if (isMissingPathError(error)) {
      if (await targetConvergedToOneLink(target, targetIdentity)) return void 0;
      throw new Error("Cache file has an external or unowned hard link");
    }
    throw error;
  }
  if (expectedClaim && !samePublicationClaimEpoch(expectedClaim, claim)) {
    throw new Error("Cache publication claim identity changed");
  }
  if (!sameFilesystemPath(claim.parent, parent.path) || claim.parentDev !== parent.dev || claim.parentIno !== parent.ino) {
    throw new Error("Cache publication claim parent identity changed");
  }
  const expectedTemporary = join(parent.path, claim.owner.publicationName);
  for (let proofAttempt = 0; proofAttempt < 100; proofAttempt += 1) {
    const entries = await readdir(parent.path);
    const matchingTemporaries = [];
    let enumerationChurn = false;
    for (const name2 of entries) {
      if (!/^\.[a-f0-9-]{36}\.tmp$/iu.test(name2)) continue;
      const temporary = join(parent.path, name2);
      await hooks.beforeEnumeratedTemporaryStat?.(temporary, target);
      let metadata;
      try {
        metadata = await lstat2(temporary, { bigint: true });
      } catch (error) {
        if (!isMissingPathError(error)) throw error;
        if (await targetConvergedToOneLink(target, targetIdentity)) {
          await validateOwnerFile(target, false);
          return void 0;
        }
        const settled = await lstat2(target, { bigint: true });
        if (!sameStatIdentity(targetMetadata, settled) || settled.nlink !== 2n) {
          throw new Error("Cache file identity changed during publication proof");
        }
        enumerationChurn = true;
        break;
      }
      if (metadata.isSymbolicLink() || !metadata.isFile()) continue;
      if (metadata.dev === targetMetadata.dev && metadata.ino === targetMetadata.ino) {
        assertSecureOwnerFileMetadata(metadata, temporary, 2n);
        if (!sameFilesystemPath(temporary, expectedTemporary)) {
          throw new Error("Cache file has an external or unowned hard link");
        }
        matchingTemporaries.push(fileIdentity(temporary, parent, metadata));
      }
    }
    if (enumerationChurn) {
      await new Promise((accept) => setTimeout(accept, 0));
      continue;
    }
    if (matchingTemporaries.length !== 1) {
      if (await targetConvergedToOneLink(target, targetIdentity)) return void 0;
      throw new Error("Cache file has an external or unowned hard link");
    }
    try {
      await validatePublicationClaim(layout, claim);
    } catch (error) {
      if (isMissingPathError(error)) {
        if (await targetConvergedToOneLink(target, targetIdentity)) return void 0;
      }
      throw error;
    }
    let currentTarget;
    let currentTemporary;
    try {
      [currentTarget, currentTemporary] = await Promise.all([
        lstat2(target, { bigint: true }),
        lstat2(expectedTemporary, { bigint: true })
      ]);
    } catch (error) {
      if (isMissingPathError(error) && await targetConvergedToOneLink(target, targetIdentity)) return void 0;
      throw error;
    }
    if (!sameStatIdentity(targetIdentity, currentTarget) || !sameStatIdentity(targetIdentity, currentTemporary) || currentTarget.nlink !== 2n || currentTemporary.nlink !== 2n) {
      if (await targetConvergedToOneLink(target, targetIdentity)) return void 0;
      throw new Error("Cache file identity changed during publication proof");
    }
    assertSecureOwnerFileMetadata(currentTarget, target, 2n);
    assertSecureOwnerFileMetadata(currentTemporary, expectedTemporary, 2n);
    return { claim, targetIdentity, temporaryIdentity: matchingTemporaries[0] };
  }
  throw new Error("Cache publication temporary enumeration did not stabilize");
}
async function recoverDeadOwnedPublicationWindow(layout, target, expected, hooks = {}) {
  const metadata = await lstat2(target, { bigint: true });
  if (sameStatIdentity(expected.targetIdentity, metadata) && metadata.nlink === 1n) {
    await finishDeadPublicationRecovery(layout, target, expected);
    return;
  }
  let current = await validateOwnedPublicationWindow(layout, target, metadata, expected.claim, hooks);
  if (!current) {
    await validateOwnerFile(target, false);
    return;
  }
  if (publicationClaimLiveness(current.claim) !== "dead") {
    throw new Error("Cache file publication claim owner is not definitively dead");
  }
  await validatePublicationClaim(layout, current.claim);
  if (publicationClaimLiveness(current.claim) !== "dead") {
    throw new Error("Cache file publication claim owner is not definitively dead");
  }
  await hooks.beforeDeadTemporaryCleanup?.(current.temporaryIdentity.path, target);
  await validatePublicationClaim(layout, current.claim);
  if (publicationClaimLiveness(current.claim) !== "dead") {
    throw new Error("Cache file publication claim owner is not definitively dead");
  }
  const afterHookMetadata = await lstat2(target, { bigint: true });
  if (sameStatIdentity(expected.targetIdentity, afterHookMetadata) && afterHookMetadata.nlink === 1n) {
    await finishDeadPublicationRecovery(layout, target, expected);
    return;
  }
  const afterHookWindow = await validateOwnedPublicationWindow(layout, target, afterHookMetadata, current.claim);
  if (!afterHookWindow) {
    await finishDeadPublicationRecovery(layout, target, current);
    return;
  }
  current = afterHookWindow;
  try {
    await removeRecordedCacheFile(layout, current.temporaryIdentity);
  } catch (error) {
    if (!isMissingPathError(error) || !await targetConvergedToOneLink(target, current.targetIdentity)) throw error;
  }
  if (!await targetConvergedToOneLink(target, current.targetIdentity)) {
    throw new Error("Dead cache publication did not converge to the exact one-link target");
  }
  await finishDeadPublicationRecovery(layout, target, current);
  const settled = await lstat2(target, { bigint: true });
  if (!sameStatIdentity(current.targetIdentity, settled) || settled.nlink !== 1n) {
    throw new Error("Recovered cache target identity changed after claim release");
  }
  assertSecureOwnerFileMetadata(settled, target, 1n);
}
async function finishDeadPublicationRecovery(layout, target, expected) {
  let cleanupFailure;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!await targetConvergedToOneLink(target, expected.targetIdentity)) {
      throw new Error("Dead cache publication target did not remain the exact one-link inode");
    }
    await validateSecurePathIdentity(layout, expected.targetIdentity);
    await validateOwnerFile(target, false);
    const observation = await observePublicationClaim(layout, target);
    if (observation.state === "absent") {
      await validateSecurePathIdentity(layout, expected.targetIdentity);
      await validateOwnerFile(target, false);
      return;
    }
    if (!samePublicationClaimEpoch(expected.claim, observation.claim)) {
      throw new Error("Cache publication claim changed during dead-publisher recovery");
    }
    if (publicationClaimLiveness(observation.claim) !== "dead") {
      throw new Error("Cache file publication claim owner is not definitively dead");
    }
    try {
      await safeRemovePublicationClaim(layout, observation.claim, false);
    } catch (error) {
      cleanupFailure = error;
      continue;
    }
    await validateSecurePathIdentity(layout, expected.targetIdentity);
    await validateOwnerFile(target, false);
    return;
  }
  throw new Error("Dead cache publication claim cleanup did not stabilize", { cause: cleanupFailure });
}
async function validateOwnerFileWithPublicationWait(layout, target, allowRepair, hooks) {
  try {
    await validateOwnerFile(target, allowRepair, hooks);
    return;
  } catch (error) {
    if (!(error instanceof UnexpectedLinkCountError) || error.metadata.nlink !== 2n) throw error;
    const identity = { dev: error.metadata.dev, ino: error.metadata.ino };
    let window = await validateOwnedPublicationWindow(layout, target, error.metadata, void 0, hooks);
    if (!window) {
      await validateOwnerFile(target, allowRepair, hooks);
      return;
    }
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const liveness = publicationClaimLiveness(window.claim);
      if (liveness === "dead") {
        await recoverDeadOwnedPublicationWindow(layout, target, window, hooks);
        await validateOwnerFile(target, allowRepair, hooks);
        return;
      }
      if (liveness === "ambiguous") {
        throw new Error("Cache file publication claim owner liveness is ambiguous");
      }
      await new Promise((accept) => setTimeout(accept, 25));
      const metadata = await lstat2(target, { bigint: true });
      if (!sameStatIdentity(identity, metadata)) throw new Error("Cache file identity changed during publication wait");
      if (metadata.nlink === 1n) {
        await validateOwnerFile(target, allowRepair, hooks);
        return;
      }
      const currentWindow = await validateOwnedPublicationWindow(layout, target, metadata, window.claim, hooks);
      if (!currentWindow) {
        await validateOwnerFile(target, allowRepair, hooks);
        return;
      }
      window = currentWindow;
    }
    throw new Error("Cache file publication did not settle to one link");
  }
}
async function validateCacheFile(layout, path, allowMissing, hooks = {}) {
  const target = assertCacheChild(layout, path, "file");
  await validateOrdinaryPathComponents(target, allowMissing ? "missing-ok" : "file");
  const parent = await realpath2(dirname2(target));
  const canonicalRoot = await realpath2(layout.root);
  if (!sameFilesystemPath(canonicalRoot, layout.root) || !isInsideOrSame(canonicalRoot, parent)) {
    throw new Error("Cache file parent resolves outside the cache root");
  }
  await validateCacheDirectoryChain(canonicalRoot, parent);
  if (await optionalLstat(target)) {
    await validateOwnerFileWithPublicationWait(layout, target, basename(target) === "changeset-hmac.key", hooks);
  }
}
async function validateCacheFiles(layout, paths) {
  if (paths.length === 0) return;
  const targets = paths.map((path) => assertCacheChild(layout, path, "file"));
  const parent = dirname2(targets[0]);
  if (targets.some((target) => !sameFilesystemPath(dirname2(target), parent))) {
    throw new Error("Batch cache-file validation requires one shared parent");
  }
  await validateOrdinaryPathComponents(parent, "directory");
  const canonicalParent = await realpath2(parent);
  const canonicalRoot = await realpath2(layout.root);
  if (!sameFilesystemPath(canonicalRoot, layout.root) || !sameFilesystemPath(canonicalParent, parent) || !isInsideOrSame(canonicalRoot, canonicalParent)) {
    throw new Error("Cache file parent resolves outside the cache root");
  }
  await validateCacheDirectoryChain(canonicalRoot, canonicalParent);
  await Promise.all(targets.map(async (target) => {
    const metadata = await lstat2(target, { bigint: true });
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error(`Cache path is not an ordinary regular file: ${target}`);
    }
    const canonical2 = await realpath2(target);
    if (!sameFilesystemPath(canonical2, target)) {
      throw new Error(`Cache path contains a symbolic-link, junction, or reparse component: ${target}`);
    }
    await validateOwnerFileWithPublicationWait(layout, target, basename(target) === "changeset-hmac.key", {});
  }));
}
async function capturePathIdentity(path, kind) {
  const target = resolve2(path);
  const canonical2 = await realpath2(target);
  if (!sameFilesystemPath(canonical2, path)) throw new Error("Cache path identity is not canonical");
  const parent = await realpath2(dirname2(canonical2));
  const [metadata, parentMetadata] = await Promise.all([
    lstat2(target, { bigint: true }),
    lstat2(parent, { bigint: true })
  ]);
  if (metadata.isSymbolicLink() || (kind === "directory" ? !metadata.isDirectory() : !metadata.isFile())) {
    throw new Error(`Cache path identity is not an ordinary ${kind}`);
  }
  if (parentMetadata.isSymbolicLink() || !parentMetadata.isDirectory()) {
    throw new Error("Cache path parent identity is not an ordinary directory");
  }
  if (kind === "directory") await validateOwnerDirectory(canonical2);
  return {
    path: canonical2,
    parent,
    dev: metadata.dev,
    ino: metadata.ino,
    kind,
    parentDev: parentMetadata.dev,
    parentIno: parentMetadata.ino
  };
}
async function validateSecurePathIdentity(layout, identity) {
  const target = identity.kind === "directory" && sameFilesystemPath(layout.root, identity.path) ? layout.root : assertCacheChild(layout, identity.path, identity.kind);
  if (!sameFilesystemPath(target, identity.path) || !sameFilesystemPath(dirname2(target), identity.parent)) {
    throw new Error("Cache path identity has an unexpected parent");
  }
  const current = await capturePathIdentity(target, identity.kind);
  if (current.dev !== identity.dev || current.ino !== identity.ino || current.kind !== identity.kind || !sameFilesystemPath(current.path, identity.path) || !sameFilesystemPath(current.parent, identity.parent) || current.parentDev !== identity.parentDev || current.parentIno !== identity.parentIno) {
    throw new Error("Cache path identity changed");
  }
}
async function captureSecurePathIdentity(layout, path, kind) {
  const target = kind === "directory" && sameFilesystemPath(layout.root, path) ? layout.root : assertCacheChild(layout, path, kind);
  return capturePathIdentity(target, kind);
}
function sameObjectIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.kind === right.kind;
}
async function removeRecordedCacheFile(layout, identity) {
  if (identity.kind !== "file") throw new Error("Recorded cache cleanup identity must describe a file");
  if (!await optionalLstat(identity.path)) throw new Error("Recorded cache file identity disappeared before cleanup");
  await validateSecurePathIdentity(layout, identity);
  await rm(identity.path);
}
function samePublicationClaimOwner(left, right) {
  return left.version === right.version && left.pid === right.pid && left.nonce === right.nonce && left.createdAtMs === right.createdAtMs && left.expiresAtMs === right.expiresAtMs && left.targetName === right.targetName && left.initializationName === right.initializationName && left.publicationName === right.publicationName;
}
function samePublicationClaimEpoch(left, right) {
  return sameObjectIdentity(left, right) && sameFilesystemPath(left.path, right.path) && sameFilesystemPath(left.parent, right.parent) && left.parentDev === right.parentDev && left.parentIno === right.parentIno && samePublicationClaimOwner(left.owner, right.owner);
}
async function readBoundedPublicationClaimOwner(layout, identity, metadata, expectedTargetName) {
  if (metadata.size < 0n || metadata.size > BigInt(maximumPublicationClaimOwnerBytes)) {
    throw new Error(`Publication claim owner exceeds its byte limit of ${maximumPublicationClaimOwnerBytes}`);
  }
  const size = Number(metadata.size);
  const handle = await open2(identity.path, "r");
  try {
    const opened = await handle.stat({ bigint: true });
    let settlementTransitionObserved = false;
    if (!samePublicationClaimFileVersion(metadata, opened)) {
      if (isPublicationClaimSettlementTransition(metadata, opened)) {
        settlementTransitionObserved = true;
      } else {
        throw new Error("Publication claim owner identity or metadata changed before bounded read");
      }
    }
    const bytes = Buffer.allocUnsafe(size);
    let offset = 0;
    while (offset < size) {
      const read = await handle.read(bytes, offset, Math.min(4096, size - offset), offset);
      if (read.bytesRead <= 0) throw new Error("Publication claim owner ended during bounded read");
      offset += read.bytesRead;
    }
    const overflow = Buffer.allocUnsafe(1);
    if ((await handle.read(overflow, 0, 1, size)).bytesRead !== 0) {
      throw new Error("Publication claim owner exceeded its validated byte length during bounded read");
    }
    const owner = parsePublicationClaimOwner(JSON.parse(bytes.toString("utf8")), expectedTargetName);
    const [finalPath, finalHandle] = await Promise.all([
      lstat2(identity.path, { bigint: true }),
      handle.stat({ bigint: true })
    ]);
    if (!samePublicationClaimFileVersion(opened, finalPath)) {
      if (!isPublicationClaimSettlementTransition(opened, finalPath)) {
        throw new Error("Publication claim owner identity or metadata changed during bounded read");
      }
      settlementTransitionObserved = true;
    }
    if (!samePublicationClaimFileVersion(opened, finalHandle)) {
      if (!isPublicationClaimSettlementTransition(opened, finalHandle)) {
        throw new Error("Publication claim owner identity or metadata changed during bounded read");
      }
      settlementTransitionObserved = true;
    }
    await validateSecurePathIdentity(layout, identity);
    if (settlementTransitionObserved) {
      throw new PublicationClaimInitializationSettled({ ...identity, kind: "file", owner });
    }
    return owner;
  } finally {
    await handle.close();
  }
}
async function capturePublicationClaim(layout, target, hooks = {}) {
  const claimPath = publicationClaimPath(target);
  let observedClaim;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const identity = await capturePathIdentity(claimPath, "file");
    const metadata = await lstat2(claimPath, { bigint: true });
    if (!sameStatIdentity(identity, metadata)) throw new Error("Publication claim identity changed during capture");
    if (metadata.nlink !== 1n && metadata.nlink !== 2n) {
      throw new Error("Publication claim has an unexpected hard-link count");
    }
    assertSecureOwnerFileMetadata(metadata, claimPath, metadata.nlink);
    await hooks.afterClaimMetadataCapture?.(claimPath, metadata);
    let owner;
    try {
      owner = await readBoundedPublicationClaimOwner(layout, identity, metadata, basename(target));
    } catch (error) {
      if (error instanceof PublicationClaimInitializationSettled) {
        if (error.claim) {
          if (observedClaim && !samePublicationClaimEpoch(observedClaim, error.claim)) {
            throw new Error("Publication claim identity or owner metadata changed while initialization settled");
          }
          observedClaim = error.claim;
        }
        continue;
      }
      throw error;
    }
    const candidate = { ...identity, kind: "file", owner };
    if (observedClaim && !samePublicationClaimEpoch(observedClaim, candidate)) {
      throw new Error("Publication claim identity or owner metadata changed while initialization settled");
    }
    observedClaim = candidate;
    const initializationPath = join(identity.parent, owner.initializationName);
    if (metadata.nlink === 1n) {
      const initializationMetadata2 = await optionalLstat(initializationPath);
      if (initializationMetadata2) {
        const currentClaim = await optionalLstat(claimPath);
        if (currentClaim && isPublicationClaimSettlementTransition(metadata, initializationMetadata2) && isPublicationClaimSettlementTransition(metadata, currentClaim)) {
          continue;
        }
        throw new Error("Publication claim initialization path is ambiguous");
      }
      return { ...identity, kind: "file", owner };
    }
    let initializationMetadata;
    try {
      initializationMetadata = await lstat2(initializationPath, { bigint: true });
    } catch (error) {
      if (isMissingPathError(error)) {
        const settled = await lstat2(claimPath, { bigint: true });
        if (sameStatIdentity(identity, settled) && settled.nlink === 1n && isPublicationClaimSettlementTransition(metadata, settled)) continue;
      }
      throw error;
    }
    if (!samePublicationClaimFileVersion(metadata, initializationMetadata)) {
      const currentClaim = await optionalLstat(claimPath);
      if (currentClaim && sameStatIdentity(identity, initializationMetadata) && isPublicationClaimSettlementTransition(metadata, initializationMetadata) && isPublicationClaimSettlementTransition(metadata, currentClaim)) {
        continue;
      }
      throw new Error("Publication claim initialization identity or metadata changed during capture");
    }
    assertSecureOwnerFileMetadata(initializationMetadata, initializationPath, 2n);
    if (!sameStatIdentity(identity, initializationMetadata)) {
      throw new Error("Publication claim initialization identity does not match the deterministic claim");
    }
    const initializationIdentity = fileIdentity(
      initializationPath,
      {
        path: identity.parent,
        parent: dirname2(identity.parent),
        dev: identity.parentDev,
        ino: identity.parentIno,
        kind: "directory",
        parentDev: 0n,
        parentIno: 0n
      },
      initializationMetadata
    );
    const current = await lstat2(claimPath, { bigint: true });
    if (!sameStatIdentity(identity, current)) throw new Error("Publication claim identity changed during capture");
    if (!samePublicationClaimFileVersion(metadata, current)) {
      if (isPublicationClaimSettlementTransition(metadata, current)) continue;
      throw new Error("Publication claim identity or metadata changed during capture");
    }
    return { ...identity, kind: "file", owner, initializationIdentity };
  }
  throw new Error("Publication claim initialization did not stabilize");
}
async function settlePublicationClaimInitialization(layout, expected) {
  let current = await capturePublicationClaim(layout, join(expected.parent, expected.owner.targetName));
  if (!samePublicationClaimEpoch(expected, current)) throw new Error("Publication claim identity or owner metadata changed");
  if (!current.initializationIdentity) return current;
  try {
    await removeRecordedCacheFile(layout, current.initializationIdentity);
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
  }
  current = await capturePublicationClaim(layout, join(expected.parent, expected.owner.targetName));
  if (!samePublicationClaimEpoch(expected, current) || current.initializationIdentity) {
    throw new Error("Publication claim initialization did not converge to one link");
  }
  return current;
}
async function createPublicationClaim(layout, target, parent, hooks) {
  const claimPath = publicationClaimPath(target);
  const initializationName = `.claim-${randomUUID()}.tmp`;
  const publicationName = `.${randomUUID()}.tmp`;
  const initializationPath = join(parent.path, initializationName);
  const owner = createPublicationClaimOwner(basename(target), initializationName, publicationName);
  const bytes = Buffer.from(`${JSON.stringify(owner)}
`, "utf8");
  let initializationIdentity;
  let initializationOwned = false;
  let linked = false;
  let primaryError;
  try {
    await hooks.beforeClaimOwnerCreate?.(initializationPath);
    await validateSecurePathIdentity(layout, parent);
    const handle = await open2(initializationPath, "wx", 384);
    initializationOwned = true;
    try {
      initializationIdentity = fileIdentity(initializationPath, parent, await handle.stat({ bigint: true }));
      const split = Math.max(1, Math.floor(bytes.byteLength / 2));
      await handle.write(bytes.subarray(0, split));
      await hooks.duringClaimOwnerWrite?.(initializationPath);
      await handle.write(bytes.subarray(split));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await hooks.beforeClaimOwnerIdentityCapture?.(initializationPath);
    const completed = await capturePathIdentity(initializationPath, "file");
    if (!initializationIdentity || !sameObjectIdentity(initializationIdentity, completed)) {
      throw new Error("Publication claim owner identity changed during creation");
    }
    await validateOwnerFile(initializationPath, false);
    const completedMetadata = await lstat2(initializationPath, { bigint: true });
    assertSecureOwnerFileMetadata(completedMetadata, initializationPath, 1n);
    const parsed = await readBoundedPublicationClaimOwner(layout, completed, completedMetadata, basename(target));
    if (!samePublicationClaimOwner(owner, parsed)) throw new Error("Publication claim owner bytes changed during creation");
    await validateSecurePathIdentity(layout, parent);
    await validateSecurePathIdentity(layout, completed);
    await hooks.beforeClaimLink?.(initializationPath, claimPath);
    await validateSecurePathIdentity(layout, parent);
    await validateSecurePathIdentity(layout, completed);
    await link(initializationPath, claimPath);
    linked = true;
    await hooks.afterClaimLink?.(initializationPath, claimPath);
    const visible = await capturePublicationClaim(layout, target);
    if (!sameObjectIdentity(completed, visible) || !samePublicationClaimOwner(owner, visible.owner) || !visible.initializationIdentity || !sameObjectIdentity(completed, visible.initializationIdentity)) {
      throw new Error("Publication claim was not atomically published from its complete owner record");
    }
    await syncPublishedTarget(layout, visible, 2n, {
      beforeFinalTargetFileSync: hooks.beforeClaimFinalFileSync,
      afterFinalTargetFileSync: hooks.afterClaimFinalFileSync
    });
    const settled = await settlePublicationClaimInitialization(layout, visible);
    initializationOwned = false;
    await syncPublishedTarget(layout, settled, 1n, {
      beforeFinalTargetFileSync: hooks.beforeClaimFinalFileSync,
      afterFinalTargetFileSync: hooks.afterClaimFinalFileSync
    });
    await syncPublicationDirectory(parent.path, hooks);
    return settled;
  } catch (error) {
    primaryError = error;
  }
  const cleanupErrors = [];
  if (linked && initializationIdentity) {
    try {
      const visible = await capturePublicationClaim(layout, target);
      if (!sameObjectIdentity(initializationIdentity, visible) || !samePublicationClaimOwner(owner, visible.owner)) {
        throw new Error("Publication claim changed before failed-creation cleanup");
      }
      const settled = await settlePublicationClaimInitialization(layout, visible);
      initializationOwned = false;
      await safeRemovePublicationClaim(layout, settled, false, hooks);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (initializationOwned && initializationIdentity) {
    try {
      await removeRecordedCacheFile(layout, initializationIdentity);
      await syncPublicationDirectory(parent.path, hooks);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      [primaryError, ...cleanupErrors],
      "Publication claim creation failed and cleanup was ambiguous",
      { cause: primaryError }
    );
  }
  throw primaryError;
}
async function observePublicationClaim(layout, target, hooks = {}) {
  const claimPath = publicationClaimPath(target);
  if (!await optionalLstat(claimPath)) return { state: "absent" };
  try {
    return { state: "owned", claim: await capturePublicationClaim(layout, target, hooks) };
  } catch (error) {
    if (!await optionalLstat(claimPath)) return { state: "absent" };
    throw new Error("Occupied publication claim is malformed or ambiguous", { cause: error });
  }
}
async function validatePublicationClaim(layout, claim) {
  const current = await capturePublicationClaim(layout, join(claim.parent, claim.owner.targetName));
  if (!samePublicationClaimEpoch(claim, current)) {
    throw new Error("Publication claim identity or owner metadata changed");
  }
}
function publicationClaimLiveness(claim, now = Date.now()) {
  if (now < claim.owner.expiresAtMs) return "alive";
  return probeProcessLiveness(claim.owner.pid);
}
async function reconcileCacheFilePublication(layout, path) {
  const target = assertCacheChild(layout, path, "file");
  const observation = await observePublicationClaim(layout, target);
  if (observation.state === "absent") {
    return { state: await optionalLstat(target) ? "present" : "absent" };
  }
  const liveness = publicationClaimLiveness(observation.claim);
  if (liveness === "ambiguous") {
    throw new Error("Cache file publication claim owner liveness is ambiguous");
  }
  if (liveness === "alive") {
    await validatePublicationClaim(layout, observation.claim);
    return { state: "active", claim: observation.claim };
  }
  return { state: await reconcileDeadFilePublicationClaim(layout, target, observation.claim, {}) };
}
async function safeRemovePublicationClaim(layout, claim, requireSnapshotClaim, hooks = {}) {
  if (claim.kind !== "file") throw new Error("Owned publication claim identity must describe a file");
  const target = assertCacheChild(layout, claim.path, "file");
  if (!/^\.publish-/u.test(basename(target)) || requireSnapshotClaim && (!isStrictlyInside(layout.indexes, target) || !/^\.publish-[a-f0-9]{64}$/iu.test(basename(target)))) {
    throw new Error("Owned publication claim has an invalid path");
  }
  const settled = await settlePublicationClaimInitialization(layout, claim);
  const releasedPath = `${claim.path}.release-${claim.owner.nonce}`;
  assertCacheChild(layout, releasedPath, "file");
  if (await optionalLstat(releasedPath)) throw new Error(`Publication claim release path already exists: ${releasedPath}`);
  const parent = await capturePathIdentity(settled.parent, "directory");
  if (parent.dev !== settled.parentDev || parent.ino !== settled.parentIno) {
    throw new Error("Publication claim parent identity changed before release");
  }
  await validatePublicationClaim(layout, settled);
  await rename(settled.path, releasedPath);
  const releasedClaim = { ...settled, path: releasedPath };
  await hooks.afterRename?.(releasedPath);
  const capturedClaim = await capturePathIdentity(releasedPath, "file");
  const releasedMetadata = await lstat2(releasedPath, { bigint: true });
  assertSecureOwnerFileMetadata(releasedMetadata, releasedPath, 1n);
  const releasedOwner = await readBoundedPublicationClaimOwner(
    layout,
    capturedClaim,
    releasedMetadata,
    settled.owner.targetName
  );
  if (!sameObjectIdentity(releasedClaim, capturedClaim) || !samePublicationClaimOwner(settled.owner, releasedOwner)) {
    throw new Error(`Released publication claim identity changed; retained exact path: ${releasedPath}`);
  }
  await removeRecordedCacheFile(layout, releasedClaim);
  await syncPublicationDirectory(settled.parent, hooks);
}
async function reconcileDeadFilePublicationClaim(layout, target, claim, hooks) {
  await validatePublicationClaim(layout, claim);
  if (publicationClaimLiveness(claim) !== "dead") {
    throw new Error("Cache file publication claim owner is not definitively dead");
  }
  const targetMetadata = await optionalLstat(target);
  if (!targetMetadata) {
    await validatePublicationClaim(layout, claim);
    if (publicationClaimLiveness(claim) !== "dead") {
      throw new Error("Cache file publication claim owner is not definitively dead");
    }
    await safeRemovePublicationClaim(layout, claim, false);
    return await optionalLstat(target) ? "present" : "absent";
  }
  if (targetMetadata.isSymbolicLink() || !targetMetadata.isFile()) {
    throw new Error("Dead cache publisher target is not an ordinary regular file");
  }
  if (targetMetadata.nlink === 2n) {
    const window = await validateOwnedPublicationWindow(layout, target, targetMetadata, claim, hooks);
    if (!window) return reconcileDeadFilePublicationClaim(layout, target, claim, hooks);
    await recoverDeadOwnedPublicationWindow(layout, target, window, hooks);
    return "present";
  }
  if (targetMetadata.nlink !== 1n) {
    throw new Error("Dead cache publisher target has an ambiguous hard-link count");
  }
  assertSecureOwnerFileMetadata(targetMetadata, target, 1n);
  const targetIdentity = await capturePathIdentity(target, "file");
  await validatePublicationClaim(layout, claim);
  if (publicationClaimLiveness(claim) !== "dead") {
    throw new Error("Cache file publication claim owner is not definitively dead");
  }
  await safeRemovePublicationClaim(layout, claim, false);
  await validateSecurePathIdentity(layout, targetIdentity);
  await validateOwnerFile(target, false);
  return "present";
}
async function acquireFilePublicationClaim(layout, target, hooks) {
  const claimPath = publicationClaimPath(target);
  const parent = await capturePathIdentity(dirname2(target), "directory");
  let observed;
  const deadline = performance2.now() + PUBLICATION_CLAIM_WAIT_MS;
  for (; ; ) {
    if (performance2.now() >= deadline) {
      throw new Error(`Cache file publication claim acquisition deadline expired: ${claimPath}`);
    }
    try {
      const created = await createPublicationClaim(layout, target, parent, hooks);
      if (performance2.now() < deadline) return created;
      try {
        await safeRemovePublicationClaim(layout, created, false);
      } catch (cleanupError) {
        throw new AggregateError(
          [new Error(`Cache file publication claim acquisition deadline expired: ${claimPath}`), cleanupError],
          "Cache file publication claim acquisition expired and cleanup was ambiguous"
        );
      }
      throw new Error(`Cache file publication claim acquisition deadline expired: ${claimPath}`);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    if (performance2.now() >= deadline) {
      throw new Error(`Cache file publication claim acquisition deadline expired: ${claimPath}`);
    }
    const observation = await observePublicationClaim(layout, target);
    if (observation.state === "absent") {
      if (await optionalLstat(target)) throw Object.assign(new Error("Cache file target already exists"), { code: "EEXIST" });
      observed = void 0;
      if (performance2.now() >= deadline) {
        throw new Error(`Cache file publication claim acquisition deadline expired: ${claimPath}`);
      }
      continue;
    }
    const current = observation.claim;
    if (!sameFilesystemPath(current.parent, parent.path) || current.parentDev !== parent.dev || current.parentIno !== parent.ino) {
      throw new Error("Cache file publication claim has an unexpected parent");
    }
    if (observed && !samePublicationClaimEpoch(observed, current)) throw new Error("Cache file publication claim identity changed");
    observed = current;
    const liveness = publicationClaimLiveness(current);
    if (liveness === "dead") {
      const resolution = await reconcileDeadFilePublicationClaim(layout, target, current, hooks);
      if (resolution === "present") throw Object.assign(new Error("Cache file target already exists"), { code: "EEXIST" });
      observed = void 0;
      continue;
    }
    if (liveness === "ambiguous") throw new Error("Cache file publication claim owner liveness is ambiguous");
    if (performance2.now() >= deadline) throw new Error(`Cache file publication claim is still owned by a live process: ${claimPath}`);
    await new Promise((accept) => setTimeout(accept, 25));
  }
}
async function publishExclusiveFile(layout, path, bytes, hooks = {}) {
  const target = assertCacheChild(layout, path, "file");
  const publicationClaim = await acquireFilePublicationClaim(layout, target, hooks);
  const temporary = join(dirname2(target), publicationClaim.owner.publicationName);
  assertCacheChild(layout, temporary, "file");
  let parentIdentity;
  let temporaryOwned = false;
  let temporaryIdentity;
  let publishedIdentity;
  let primaryError;
  try {
    await hooks.afterClaimAcquire?.(publicationClaim);
    parentIdentity = await capturePathIdentity(dirname2(target), "directory");
    if (!sameFilesystemPath(parentIdentity.path, publicationClaim.parent) || parentIdentity.dev !== publicationClaim.parentDev || parentIdentity.ino !== publicationClaim.parentIno) {
      throw new Error("Cache file publication parent identity changed after claim acquisition");
    }
    await hooks.beforeTemporaryCreate?.(temporary);
    await validateSecurePathIdentity(layout, parentIdentity);
    const handle = await open2(temporary, "wx", 384);
    temporaryOwned = true;
    try {
      const metadata = await handle.stat({ bigint: true });
      temporaryIdentity = {
        path: temporary,
        parent: parentIdentity.path,
        dev: metadata.dev,
        ino: metadata.ino,
        kind: "file",
        parentDev: parentIdentity.dev,
        parentIno: parentIdentity.ino
      };
      await handle.writeFile(bytes);
      await handle.sync();
      await hooks.afterTemporaryFileSync?.(temporary);
    } finally {
      await handle.close();
    }
    await validateOwnerFile(temporary, false);
    await hooks.afterTemporaryCreate?.(temporary);
    await validateSecurePathIdentity(layout, temporaryIdentity);
    await hooks.beforeLink?.(temporary, target);
    await validateSecurePathIdentity(layout, parentIdentity);
    await validateSecurePathIdentity(layout, temporaryIdentity);
    await link(temporary, target);
    await hooks.afterLink?.(temporary, target);
    const [temporaryAfterLink, targetAfterLink] = await Promise.all([
      capturePathIdentity(temporary, "file"),
      capturePathIdentity(target, "file")
    ]);
    if (!sameObjectIdentity(temporaryIdentity, temporaryAfterLink) || !sameObjectIdentity(temporaryIdentity, targetAfterLink)) {
      throw new Error("Published cache file identity does not match the owned temporary file");
    }
    const [temporaryMetadata, targetMetadata] = await Promise.all([
      lstat2(temporary, { bigint: true }),
      lstat2(target, { bigint: true })
    ]);
    if (temporaryMetadata.nlink !== 2n || targetMetadata.nlink !== 2n) {
      throw new Error("Published cache file has an unexpected hard-link count");
    }
    publishedIdentity = targetAfterLink;
    await hooks.afterPublishedIdentity?.(publishedIdentity);
    await syncPublishedTarget(layout, publishedIdentity, 2n, hooks);
    await syncPublicationDirectory(parentIdentity.path, hooks);
  } catch (error) {
    primaryError = error;
  }
  let cleanupError;
  if (temporaryOwned && !temporaryIdentity) {
    cleanupError = new Error("Owned temporary cache file identity could not be recorded for cleanup");
  } else if (temporaryIdentity) {
    try {
      await hooks.beforeTemporaryCleanup?.(temporary);
      await removeRecordedCacheFile(layout, temporaryIdentity);
      if (publishedIdentity) await syncPublishedTarget(layout, publishedIdentity, 1n, hooks);
      await syncPublicationDirectory(temporaryIdentity.parent, hooks);
      await hooks.afterTemporaryCleanup?.(temporary, target);
    } catch (error) {
      cleanupError = error;
    }
  }
  let completionError = primaryError;
  if (completionError === void 0 && cleanupError !== void 0) completionError = cleanupError;
  if (primaryError !== void 0 && cleanupError !== void 0) {
    completionError = new AggregateError(
      [primaryError, cleanupError],
      "Cache file publication failed and temporary cleanup was ambiguous",
      { cause: primaryError }
    );
  }
  if (completionError === void 0) {
    try {
      if (!publishedIdentity) throw new Error("Cache file publication did not produce a target identity");
      await validateCacheFile(layout, target, false);
      const finalIdentity = await capturePathIdentity(target, "file");
      if (!sameObjectIdentity(publishedIdentity, finalIdentity)) {
        throw new Error("Published cache file identity changed after temporary cleanup");
      }
    } catch (error) {
      completionError = error;
    }
  }
  let claimCleanupError;
  try {
    await safeRemovePublicationClaim(layout, publicationClaim, false, hooks);
  } catch (error) {
    claimCleanupError = error;
  }
  if (completionError !== void 0 && claimCleanupError !== void 0) {
    throw new AggregateError(
      [completionError, claimCleanupError],
      "Cache file publication failed and claim cleanup was ambiguous",
      { cause: completionError }
    );
  }
  if (completionError !== void 0) throw completionError;
  if (claimCleanupError !== void 0) throw claimCleanupError;
}
var exactRemovalIntentPattern = /^\.remove-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/u;
var exactRemovalCandidatePattern = new RegExp(
  "^\\.remove-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\\.owner-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.tmp$",
  "u"
);
var exactRemovalQuarantinePattern = /^\.removed-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-((?:0|[1-9][0-9]*))-((?:0|[1-9][0-9]*))\.data$/u;
var legacyExactRemovalQuarantinePattern = /^\.removed-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.data$/u;
var maximumExactRemovalIntentBytes = 4 * 1024;
function createExactRemovalOperationContext(hooks) {
  return {
    kind: "hookful",
    work: new CounterBudget("Exact-removal recovery work", changesetRemovalRecoveryLimits.maxWork),
    deadline: new DeadlineBudget(
      "Exact-removal recovery",
      changesetRemovalRecoveryLimits.deadlineMs,
      hooks.removalRecoveryNow
    ),
    // Final critical windows cannot call the injectable clock: it is an
    // external callback and may mutate filesystem state. The production
    // monotonic clock still bounds every I/O performed inside those windows.
    finalWindowDeadline: new DeadlineBudget(
      "Exact-removal final critical window",
      changesetRemovalRecoveryLimits.deadlineMs
    )
  };
}
function exactRemovalStep(context) {
  context.work.consume();
  context.deadline.check();
}
async function exactRemovalOperation(context, operation) {
  exactRemovalStep(context);
  const result = await operation();
  context.deadline.check();
  return result;
}
async function withExactRemovalFinalWindow(context, operation) {
  context.deadline.check();
  const finalContext = {
    kind: "final",
    finalContextToken: "native-exact-removal-final",
    work: context.work,
    deadline: context.finalWindowDeadline
  };
  return operation(finalContext);
}
async function closeExactRemovalResource(resource, path, kind, hooks) {
  try {
    if (hooks.closeExactRemovalResource) {
      await hooks.closeExactRemovalResource(resource, path, kind);
    } else {
      await resource.close();
    }
  } catch (error) {
    if (kind === "directory" && error.code === "ERR_DIR_CLOSED") return;
    throw error;
  }
}
async function closeExactRemovalResourceAfterError(resource, path, kind, hooks, primaryError) {
  try {
    await closeExactRemovalResource(resource, path, kind, hooks);
  } catch (cleanupError) {
    throw new AggregateError(
      [primaryError, cleanupError],
      `Exact-removal ${kind} cleanup failed while preserving the primary operation error`,
      { cause: primaryError }
    );
  }
  throw primaryError;
}
async function acquireExactRemovalResource(context, hooks, path, kind, acquire) {
  exactRemovalStep(context);
  const resource = await acquire();
  try {
    if (hooks.afterExactRemovalResourceAcquire) {
      exactRemovalStep(context);
      await hooks.afterExactRemovalResourceAcquire(path, kind);
    }
    context.deadline.check();
    return resource;
  } catch (primaryError) {
    return closeExactRemovalResourceAfterError(resource, path, kind, hooks, primaryError);
  }
}
async function withExactRemovalResource(context, hooks, path, kind, acquire, use) {
  const resource = await acquireExactRemovalResource(context, hooks, path, kind, acquire);
  let result;
  try {
    result = await use(resource);
  } catch (primaryError) {
    return closeExactRemovalResourceAfterError(resource, path, kind, hooks, primaryError);
  }
  await closeExactRemovalResource(resource, path, kind, hooks);
  return result;
}
async function closeExactRemovalFinalResource(resource, kind) {
  try {
    await resource.close();
  } catch (error) {
    if (kind === "directory" && error.code === "ERR_DIR_CLOSED") return;
    throw error;
  }
}
async function acquireExactRemovalFinalResource(context, kind, acquire) {
  exactRemovalStep(context);
  const resource = await acquire();
  try {
    context.deadline.check();
    return resource;
  } catch (primaryError) {
    try {
      await closeExactRemovalFinalResource(resource, kind);
    } catch (cleanupError) {
      throw new AggregateError(
        [primaryError, cleanupError],
        `Exact-removal final ${kind} cleanup failed while preserving the primary operation error`,
        { cause: primaryError }
      );
    }
    throw primaryError;
  }
}
async function withExactRemovalFinalResource(context, kind, acquire, use) {
  const resource = await acquireExactRemovalFinalResource(context, kind, acquire);
  let result;
  try {
    result = await use(resource);
  } catch (primaryError) {
    try {
      await closeExactRemovalFinalResource(resource, kind);
    } catch (cleanupError) {
      throw new AggregateError(
        [primaryError, cleanupError],
        `Exact-removal final ${kind} cleanup failed while preserving the primary operation error`,
        { cause: primaryError }
      );
    }
    throw primaryError;
  }
  await closeExactRemovalFinalResource(resource, kind);
  return result;
}
async function syncExactRemovalDirectoryFinal(directory, context) {
  return withExactRemovalFinalResource(
    context,
    "directory",
    () => open2(directory, "r"),
    async (handle) => {
      try {
        await exactRemovalOperation(context, () => handle.sync());
        return "synced";
      } catch (error) {
        const code = error.code;
        if (process.platform !== "win32" || !code || !windowsUnsupportedDirectorySyncCodes.has(code)) throw error;
        return "unsupported";
      }
    }
  );
}
var exactRemovalJournalLocks = /* @__PURE__ */ new Map();
async function withExactRemovalJournalLock(locksPath, operation) {
  const key = process.platform === "win32" ? locksPath.toLocaleLowerCase("en-US") : locksPath;
  let state = exactRemovalJournalLocks.get(key);
  if (!state) {
    state = { tail: Promise.resolve(), users: 0 };
    exactRemovalJournalLocks.set(key, state);
  }
  state.users += 1;
  const predecessor = state.tail;
  let release;
  const turn = new Promise((resolveTurn) => {
    release = resolveTurn;
  });
  state.tail = predecessor.then(() => turn);
  await predecessor;
  try {
    return await operation();
  } finally {
    release();
    state.users -= 1;
    if (state.users === 0 && exactRemovalJournalLocks.get(key) === state) {
      exactRemovalJournalLocks.delete(key);
    }
  }
}
var ExactRemovalByteLedger = class {
  #sizes = /* @__PURE__ */ new Map();
  #total = 0;
  charge(identity, size) {
    if (size > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Exact-removal artifact size is not safely countable");
    const numericSize = Number(size);
    const key = `${identity.dev}:${identity.ino}`;
    const previous = this.#sizes.get(key) ?? 0;
    const nextTotal = this.#total - previous + numericSize;
    if (nextTotal > changesetRemovalRecoveryLimits.maxBytes) {
      throw new Error(
        `Exact-removal recovery bytes exceed the limit of ${changesetRemovalRecoveryLimits.maxBytes} bytes`
      );
    }
    this.#sizes.set(key, numericSize);
    this.#total = nextTotal;
    return numericSize;
  }
  release(identity) {
    const key = `${identity.dev}:${identity.ino}`;
    const previous = this.#sizes.get(key);
    if (previous === void 0) return;
    this.#sizes.delete(key);
    this.#total -= previous;
  }
  get total() {
    return this.#total;
  }
};
function exactRemovalIntent(identity, quarantinePath) {
  return {
    version: 1,
    targetPath: identity.path,
    targetParent: identity.parent,
    quarantinePath,
    dev: String(identity.dev),
    ino: String(identity.ino),
    parentDev: String(identity.parentDev),
    parentIno: String(identity.parentIno)
  };
}
function hasExactRemovalInspectionHooks(hooks) {
  return hooks.beforeRemovalArtifactUse !== void 0 || hooks.readRemovalIntentChunk !== void 0 || hooks.afterExactRemovalResourceAcquire !== void 0 || hooks.closeExactRemovalResource !== void 0;
}
function hasExactRemovalPostClaimHooks(hooks) {
  return hasExactRemovalInspectionHooks(hooks) || hooks.afterExactRemovalQuarantineClaim !== void 0 || hooks.afterExactRemovalArtifactSync !== void 0 || hooks.beforeParentDirectoryOpen !== void 0 || hooks.afterParentDirectorySync !== void 0;
}
function canReuseRecoveryReservation(hooks) {
  const allowedOutsideRecovery = /* @__PURE__ */ new Set([
    "duringRemovalIntentCandidateWrite",
    "beforeRemovalIntentLink",
    "afterRemovalIntentLink",
    "writeRemovalIntentChunk"
  ]);
  return Object.entries(hooks).every(([name2, value]) => value === void 0 || allowedOutsideRecovery.has(name2));
}
function parseExactRemovalIntent(layout, intentPath, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Exact-removal intent is not an object");
  const record = value;
  const expectedKeys = ["dev", "ino", "parentDev", "parentIno", "quarantinePath", "targetParent", "targetPath", "version"];
  if (Object.keys(record).sort().join("\0") !== expectedKeys.join("\0") || record.version !== 1) {
    throw new Error("Exact-removal intent has an unexpected schema");
  }
  for (const key of ["dev", "ino", "parentDev", "parentIno"]) {
    if (typeof record[key] !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(record[key])) {
      throw new Error(`Exact-removal intent has an invalid ${key}`);
    }
  }
  if (typeof record.targetPath !== "string" || typeof record.targetParent !== "string" || typeof record.quarantinePath !== "string") {
    throw new Error("Exact-removal intent has an invalid target path");
  }
  const target = assertCacheChild(layout, record.targetPath, "file");
  const parent = resolve2(record.targetParent);
  if (!sameFilesystemPath(target, record.targetPath) || !sameFilesystemPath(dirname2(target), parent) || !sameFilesystemPath(parent, record.targetParent)) {
    throw new Error("Exact-removal intent target has an unexpected parent");
  }
  const quarantinePath = assertCacheChild(layout, record.quarantinePath, "file");
  const intentId = basename(intentPath).slice(".remove-".length, -".json".length);
  const quarantineName = basename(quarantinePath);
  const boundQuarantine = exactRemovalQuarantinePattern.exec(quarantineName);
  const legacyQuarantine = quarantineName === `.removed-${intentId}.data` && legacyExactRemovalQuarantinePattern.test(quarantineName);
  if (!sameFilesystemPath(dirname2(quarantinePath), layout.locks) || !legacyQuarantine && (!boundQuarantine || boundQuarantine[1] !== intentId || boundQuarantine[2] !== record.dev || boundQuarantine[3] !== record.ino)) {
    throw new Error("Exact-removal intent has an invalid quarantine path");
  }
  return { targetIdentity: {
    path: target,
    parent,
    dev: BigInt(record.dev),
    ino: BigInt(record.ino),
    kind: "file",
    parentDev: BigInt(record.parentDev),
    parentIno: BigInt(record.parentIno)
  }, quarantinePath };
}
async function validateExactCacheFile(layout, identity, expectedLinks, context) {
  if (identity.kind !== "file") throw new Error("Exact cache cleanup identity must describe a file");
  await exactRemovalOperation(context, () => validateSecurePathIdentity(layout, identity));
  const metadata = await exactRemovalOperation(context, () => lstat2(identity.path, { bigint: true }));
  if (!sameStatIdentity(identity, metadata)) throw new Error("Exact cache cleanup identity changed before unlink");
  assertSecureOwnerFileMetadata(metadata, identity.path, expectedLinks);
}
async function validateExactOneLinkCacheFile(layout, identity, context) {
  await validateExactCacheFile(layout, identity, 1n, context);
}
async function removeExactRemovalIntent(layout, intentIdentity, hooks, context) {
  await validateExactOneLinkCacheFile(layout, intentIdentity, context);
  await exactRemovalOperation(context, () => rm(intentIdentity.path));
  await exactRemovalOperation(context, () => syncPublicationDirectory(intentIdentity.parent, hooks));
}
function exactRemovalArtifactMaxBytes(kind) {
  return kind === "candidate" || kind === "intent" ? maximumExactRemovalIntentBytes : changesetRemovalRecoveryLimits.maxArtifactBytes;
}
async function validateExactRemovalArtifactForUse(layout, path, identity, kind, expectedLinks, hooks, context, ledger, invokeHook = true) {
  const operationHooks = invokeHook ? hooks : { removalRecoveryNow: hooks.removalRecoveryNow };
  if (invokeHook && hooks.beforeRemovalArtifactUse) {
    await exactRemovalOperation(context, () => hooks.beforeRemovalArtifactUse(path, kind));
  }
  const metadata = await withExactRemovalResource(
    context,
    operationHooks,
    path,
    "file",
    () => open2(path, "r"),
    async (handle) => {
      const observed = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(identity, observed)) {
        throw new Error(`Exact-removal ${kind} identity changed before use`);
      }
      assertSecureOwnerFileMetadata(observed, path, expectedLinks);
      if (observed.size > BigInt(exactRemovalArtifactMaxBytes(kind))) {
        throw new Error(`Exact-removal ${kind} exceeds its byte limit`);
      }
      return observed;
    }
  );
  const finalMetadata = await exactRemovalOperation(context, () => lstat2(path, { bigint: true }));
  if (!sameStatIdentity(identity, finalMetadata) || finalMetadata.size !== metadata.size) {
    throw new Error(`Exact-removal ${kind} changed during final metadata validation`);
  }
  assertSecureOwnerFileMetadata(finalMetadata, path, expectedLinks);
  ledger.charge(identity, finalMetadata.size);
  return finalMetadata;
}
async function validateExactRemovalArtifactForUseFinal(layout, path, identity, kind, expectedLinks, context, ledger) {
  const metadata = await withExactRemovalFinalResource(
    context,
    "file",
    () => open2(path, "r"),
    async (handle) => {
      const observed = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(identity, observed)) {
        throw new Error(`Exact-removal ${kind} identity changed before final use`);
      }
      assertSecureOwnerFileMetadata(observed, path, expectedLinks);
      if (observed.size > BigInt(exactRemovalArtifactMaxBytes(kind))) {
        throw new Error(`Exact-removal ${kind} exceeds its byte limit`);
      }
      return observed;
    }
  );
  const finalMetadata = await exactRemovalOperation(context, () => lstat2(path, { bigint: true }));
  if (!sameStatIdentity(identity, finalMetadata) || finalMetadata.size !== metadata.size) {
    throw new Error(`Exact-removal ${kind} changed during final metadata validation`);
  }
  assertSecureOwnerFileMetadata(finalMetadata, path, expectedLinks);
  ledger.charge(identity, finalMetadata.size);
  return finalMetadata;
}
async function readExactRemovalIntent(layout, intentPath, intentIdentity, expectedLinks, hooks, context, ledger, invokeHooks = true) {
  const operationHooks = invokeHooks ? hooks : { removalRecoveryNow: hooks.removalRecoveryNow };
  const target = assertCacheChild(layout, intentPath, "file");
  if (!sameFilesystemPath(dirname2(target), layout.locks) || !exactRemovalIntentPattern.test(basename(target))) {
    throw new Error("Exact-removal intent has an invalid path");
  }
  await validateExactRemovalArtifactForUse(
    layout,
    target,
    intentIdentity,
    "intent",
    expectedLinks,
    operationHooks,
    context,
    ledger,
    invokeHooks
  );
  const bytes = await withExactRemovalResource(
    context,
    operationHooks,
    target,
    "file",
    () => open2(target, "r"),
    async (handle) => {
      const before = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(intentIdentity, before)) throw new Error("Exact-removal intent identity changed before read");
      assertSecureOwnerFileMetadata(before, target, expectedLinks);
      if (before.size > BigInt(maximumExactRemovalIntentBytes)) throw new Error("Exact-removal intent exceeds its byte limit");
      const expectedBytes = Number(before.size);
      const observed = Buffer.alloc(expectedBytes);
      let offset = 0;
      while (offset < expectedBytes) {
        const length = expectedBytes - offset;
        const bytesRead = await exactRemovalOperation(context, async () => invokeHooks && hooks.readRemovalIntentChunk ? hooks.readRemovalIntentChunk(handle, observed, offset, length, offset) : (await handle.read(observed, offset, length, offset)).bytesRead);
        if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || bytesRead > length) {
          throw new Error("Exact-removal intent reader returned an invalid bounded byte count");
        }
        if (bytesRead === 0) throw new Error("Exact-removal intent ended before its exact metadata length");
        offset += bytesRead;
      }
      const eof = Buffer.alloc(1);
      const eofBytes = await exactRemovalOperation(context, async () => invokeHooks && hooks.readRemovalIntentChunk ? hooks.readRemovalIntentChunk(handle, eof, 0, 1, expectedBytes) : (await handle.read(eof, 0, 1, expectedBytes)).bytesRead);
      if (eofBytes !== 0) throw new Error("Exact-removal intent grew beyond its exact metadata length");
      const after = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(intentIdentity, after) || after.size !== before.size) {
        throw new Error("Exact-removal intent changed during bounded read");
      }
      assertSecureOwnerFileMetadata(after, target, expectedLinks);
      return observed;
    }
  );
  await validateExactRemovalArtifactForUse(
    layout,
    target,
    intentIdentity,
    "intent",
    expectedLinks,
    operationHooks,
    context,
    ledger,
    false
  );
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error("Exact-removal intent is not valid JSON", { cause: error });
  }
  const parsedIntent = parseExactRemovalIntent(layout, intentPath, parsed);
  return { intentIdentity, ...parsedIntent, bytes };
}
async function readExactRemovalIntentFinal(layout, intentPath, intentIdentity, expectedLinks, context, ledger) {
  const target = assertCacheChild(layout, intentPath, "file");
  if (!sameFilesystemPath(dirname2(target), layout.locks) || !exactRemovalIntentPattern.test(basename(target))) {
    throw new Error("Exact-removal intent has an invalid path");
  }
  await validateExactRemovalArtifactForUseFinal(
    layout,
    target,
    intentIdentity,
    "intent",
    expectedLinks,
    context,
    ledger
  );
  const bytes = await withExactRemovalFinalResource(
    context,
    "file",
    () => open2(target, "r"),
    async (handle) => {
      const before = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(intentIdentity, before)) throw new Error("Exact-removal intent identity changed before final read");
      assertSecureOwnerFileMetadata(before, target, expectedLinks);
      if (before.size > BigInt(maximumExactRemovalIntentBytes)) throw new Error("Exact-removal intent exceeds its byte limit");
      const expectedBytes = Number(before.size);
      const observed = Buffer.alloc(expectedBytes);
      let offset = 0;
      while (offset < expectedBytes) {
        const length = expectedBytes - offset;
        const bytesRead = await exactRemovalOperation(
          context,
          async () => (await handle.read(observed, offset, length, offset)).bytesRead
        );
        if (!Number.isSafeInteger(bytesRead) || bytesRead <= 0 || bytesRead > length) {
          throw new Error("Exact-removal final intent reader returned an invalid bounded byte count");
        }
        offset += bytesRead;
      }
      const eof = Buffer.alloc(1);
      const eofBytes = await exactRemovalOperation(
        context,
        async () => (await handle.read(eof, 0, 1, expectedBytes)).bytesRead
      );
      if (eofBytes !== 0) throw new Error("Exact-removal intent grew beyond its exact metadata length");
      const after = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(intentIdentity, after) || after.size !== before.size) {
        throw new Error("Exact-removal intent changed during final bounded read");
      }
      assertSecureOwnerFileMetadata(after, target, expectedLinks);
      return observed;
    }
  );
  await validateExactRemovalArtifactForUseFinal(
    layout,
    target,
    intentIdentity,
    "intent",
    expectedLinks,
    context,
    ledger
  );
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error("Exact-removal intent is not valid JSON", { cause: error });
  }
  return { intentIdentity, ...parseExactRemovalIntent(layout, intentPath, parsed), bytes };
}
function assertExactRemovalIntentSemantic(observed, expectedTarget, expectedQuarantinePath) {
  if (!sameObjectIdentity(observed.targetIdentity, expectedTarget) || !sameFilesystemPath(observed.targetIdentity.path, expectedTarget.path) || !sameFilesystemPath(observed.targetIdentity.parent, expectedTarget.parent) || !sameFilesystemPath(observed.quarantinePath, expectedQuarantinePath)) {
    throw new Error("Exact-removal intent semantic value does not match the authoritative expected removal");
  }
}
async function validateExpectedExactRemovalIntent(layout, intentPath, intentIdentity, expectedLinks, expectedBytes, expectedTarget, expectedQuarantinePath, hooks, context, ledger) {
  const observed = await readExactRemovalIntent(
    layout,
    intentPath,
    intentIdentity,
    expectedLinks,
    hooks,
    context,
    ledger
  );
  if (!observed.bytes.equals(expectedBytes)) {
    throw new Error("Exact-removal intent bytes do not match the authoritative expected intent");
  }
  assertExactRemovalIntentSemantic(observed, expectedTarget, expectedQuarantinePath);
  const authoritative = await readExactRemovalIntent(
    layout,
    intentPath,
    intentIdentity,
    expectedLinks,
    hooks,
    context,
    ledger,
    false
  );
  if (!authoritative.bytes.equals(expectedBytes)) {
    throw new Error("Exact-removal intent bytes changed after mutation hooks completed");
  }
  assertExactRemovalIntentSemantic(authoritative, expectedTarget, expectedQuarantinePath);
}
async function inspectExpectedExactRemovalIntentFinal(layout, intentPath, intentIdentity, expectedLinks, expectedBytes, expectedTarget, expectedQuarantinePath, context, ledger) {
  const authoritative = await readExactRemovalIntentFinal(
    layout,
    intentPath,
    intentIdentity,
    expectedLinks,
    context,
    ledger
  );
  if (!authoritative.bytes.equals(expectedBytes)) {
    throw new Error("Exact-removal intent bytes changed before the final critical mutation");
  }
  assertExactRemovalIntentSemantic(authoritative, expectedTarget, expectedQuarantinePath);
}
async function validateExactRemovalParent(layout, identity, context) {
  await exactRemovalOperation(context, () => validateCacheDirectoryChain(layout.root, identity.parent));
  const parentMetadata = await exactRemovalOperation(context, () => lstat2(identity.parent, { bigint: true }));
  if (parentMetadata.dev !== identity.parentDev || parentMetadata.ino !== identity.parentIno) {
    throw new Error("Exact cache cleanup parent identity changed");
  }
}
async function syncExactCacheFile(layout, identity, expectedLinks, hooks, context, maxBytes, ledger) {
  await validateExactCacheFile(layout, identity, expectedLinks, context);
  await withExactRemovalResource(
    context,
    hooks,
    identity.path,
    "file",
    () => open2(identity.path, "r+"),
    async (handle) => {
      const before = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(identity, before)) throw new Error("Exact cache cleanup quarantine identity changed before sync");
      assertSecureOwnerFileMetadata(before, identity.path, expectedLinks);
      if (before.size > BigInt(maxBytes)) throw new Error("Exact cache cleanup object exceeds its byte limit before sync");
      ledger.charge(identity, before.size);
      await exactRemovalOperation(context, () => handle.sync());
      if (hooks.afterExactRemovalArtifactSync) {
        await exactRemovalOperation(context, () => hooks.afterExactRemovalArtifactSync(identity.path));
      }
      const after = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(identity, after)) throw new Error("Exact cache cleanup quarantine identity changed during sync");
      assertSecureOwnerFileMetadata(after, identity.path, expectedLinks);
      if (after.size > BigInt(maxBytes)) throw new Error("Exact cache cleanup object exceeds its byte limit during sync");
      ledger.charge(identity, after.size);
    }
  );
  await validateExactCacheFile(layout, identity, expectedLinks, context);
  const finalMetadata = await exactRemovalOperation(context, () => lstat2(identity.path, { bigint: true }));
  if (!sameStatIdentity(identity, finalMetadata) || finalMetadata.size > BigInt(maxBytes)) {
    throw new Error("Exact cache cleanup object changed or exceeds its byte limit after sync");
  }
  assertSecureOwnerFileMetadata(finalMetadata, identity.path, expectedLinks);
  ledger.charge(identity, finalMetadata.size);
}
async function syncExactOneLinkCacheFile(layout, identity, hooks, context, maxBytes, ledger) {
  await syncExactCacheFile(layout, identity, 1n, hooks, context, maxBytes, ledger);
}
async function syncExactOneLinkCacheFileFinal(layout, identity, context, maxBytes, ledger) {
  await validateExactCacheFile(layout, identity, 1n, context);
  await withExactRemovalFinalResource(
    context,
    "file",
    () => open2(identity.path, "r+"),
    async (handle) => {
      const before = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(identity, before)) throw new Error("Exact cache cleanup final identity changed before sync");
      assertSecureOwnerFileMetadata(before, identity.path, 1n);
      if (before.size > BigInt(maxBytes)) throw new Error("Exact cache cleanup final object exceeds its byte limit before sync");
      ledger.charge(identity, before.size);
      await exactRemovalOperation(context, () => handle.sync());
      const after = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(identity, after)) throw new Error("Exact cache cleanup final identity changed during sync");
      assertSecureOwnerFileMetadata(after, identity.path, 1n);
      if (after.size > BigInt(maxBytes)) throw new Error("Exact cache cleanup final object exceeds its byte limit during sync");
      ledger.charge(identity, after.size);
    }
  );
  await validateExactCacheFile(layout, identity, 1n, context);
  const finalMetadata = await exactRemovalOperation(context, () => lstat2(identity.path, { bigint: true }));
  if (!sameStatIdentity(identity, finalMetadata) || finalMetadata.size > BigInt(maxBytes)) {
    throw new Error("Exact cache cleanup final object changed or exceeds its byte limit after sync");
  }
  assertSecureOwnerFileMetadata(finalMetadata, identity.path, 1n);
  ledger.charge(identity, finalMetadata.size);
}
async function quarantineExactRemovalTarget(layout, intentPath, intentIdentity, expectedIntentBytes, targetIdentity, quarantinePath, locksIdentity, hooks, context, ledger, visibleState, afterTargetUnlink = () => void 0, reuseFinalReservation = false) {
  if (await exactRemovalOperation(context, () => optionalLstat(quarantinePath))) {
    throw new Error("Exact cache cleanup quarantine path is already occupied");
  }
  await validateExactRemovalParent(layout, targetIdentity, context);
  await exactRemovalOperation(context, () => validateSecurePathIdentity(layout, locksIdentity));
  if (hooks.beforeExactRemovalUnlink) {
    await exactRemovalOperation(context, () => hooks.beforeExactRemovalUnlink(targetIdentity.path));
  }
  if (hasExactRemovalInspectionHooks(hooks)) {
    await inspectExactRemovalTargetSize(layout, targetIdentity, hooks, context);
    await inspectExactRemovalJournal(layout, hooks, context);
    await validateExpectedExactRemovalIntent(
      layout,
      intentPath,
      intentIdentity,
      1n,
      expectedIntentBytes,
      targetIdentity,
      quarantinePath,
      hooks,
      context,
      ledger
    );
  }
  const { finalReservation, targetBytes } = await withExactRemovalFinalWindow(context, async (finalContext) => {
    const finalReservation2 = reuseFinalReservation ? { totalEntries: visibleState.entries, physicalBytes: visibleState.ledger.total, ledger: visibleState.ledger } : await inspectExactRemovalJournalFinal(layout, finalContext);
    const targetBytes2 = await inspectExactRemovalTargetSizeFinal(layout, targetIdentity, finalContext);
    await inspectExpectedExactRemovalIntentFinal(
      layout,
      intentPath,
      intentIdentity,
      1n,
      expectedIntentBytes,
      targetIdentity,
      quarantinePath,
      finalContext,
      finalReservation2.ledger
    );
    if (await exactRemovalOperation(finalContext, () => optionalLstat(quarantinePath))) {
      throw new Error("Exact cache cleanup quarantine path became occupied before exclusive claim");
    }
    await validateExactRemovalParent(layout, targetIdentity, finalContext);
    await exactRemovalOperation(finalContext, () => validateSecurePathIdentity(layout, locksIdentity));
    await validateExactOneLinkCacheFile(layout, targetIdentity, finalContext);
    assertExactRemovalJournalHeadroom(
      finalReservation2.totalEntries,
      1,
      finalReservation2.ledger.total,
      targetBytes2
    );
    await exactRemovalOperation(finalContext, () => link(targetIdentity.path, quarantinePath));
    return { finalReservation: finalReservation2, targetBytes: targetBytes2 };
  });
  visibleState.entries = finalReservation.totalEntries;
  visibleState.ledger = finalReservation.ledger;
  ledger = finalReservation.ledger;
  visibleState.entries += 1;
  visibleState.ledger.charge(targetIdentity, BigInt(targetBytes));
  let metadata = await exactRemovalOperation(context, () => lstat2(quarantinePath, { bigint: true }));
  if (!sameStatIdentity(targetIdentity, metadata)) throw new Error("Exact cache cleanup quarantine claim identity changed");
  assertSecureOwnerFileMetadata(metadata, quarantinePath, 2n);
  let quarantineIdentity = fileIdentity(quarantinePath, locksIdentity, metadata);
  await syncExactCacheFile(
    layout,
    quarantineIdentity,
    2n,
    hooks,
    context,
    changesetRemovalRecoveryLimits.maxArtifactBytes,
    visibleState.ledger
  );
  await exactRemovalOperation(context, () => syncPublicationDirectory(layout.locks, hooks));
  if (hooks.afterExactRemovalQuarantineClaim) {
    await exactRemovalOperation(
      context,
      () => hooks.afterExactRemovalQuarantineClaim(targetIdentity.path, quarantinePath)
    );
  }
  const postClaimNeedsRescan = hasExactRemovalPostClaimHooks(hooks);
  if (postClaimNeedsRescan) {
    await inspectExactRemovalJournal(layout, hooks, context);
  }
  if (hasExactRemovalInspectionHooks(hooks)) {
    await validateExpectedExactRemovalIntent(
      layout,
      intentPath,
      intentIdentity,
      1n,
      expectedIntentBytes,
      targetIdentity,
      quarantinePath,
      hooks,
      context,
      ledger
    );
  }
  const beforeUnlink = await withExactRemovalFinalWindow(context, async (finalContext) => {
    const beforeUnlink2 = postClaimNeedsRescan ? await inspectExactRemovalJournalFinal(layout, finalContext) : { totalEntries: visibleState.entries, physicalBytes: visibleState.ledger.total, ledger: visibleState.ledger };
    await inspectExpectedExactRemovalIntentFinal(
      layout,
      intentPath,
      intentIdentity,
      1n,
      expectedIntentBytes,
      targetIdentity,
      quarantinePath,
      finalContext,
      beforeUnlink2.ledger
    );
    const [claimedTarget, claimedQuarantine] = await Promise.all([
      exactRemovalOperation(finalContext, () => lstat2(targetIdentity.path, { bigint: true })),
      exactRemovalOperation(finalContext, () => lstat2(quarantinePath, { bigint: true }))
    ]);
    if (!sameStatIdentity(targetIdentity, claimedTarget) || !sameStatIdentity(targetIdentity, claimedQuarantine)) {
      throw new Error("Exact cache cleanup target or quarantine claim identity changed before unlink");
    }
    assertSecureOwnerFileMetadata(claimedTarget, targetIdentity.path, 2n);
    assertSecureOwnerFileMetadata(claimedQuarantine, quarantinePath, 2n);
    await validateExactCacheFile(layout, targetIdentity, 2n, finalContext);
    await exactRemovalOperation(finalContext, () => rm(targetIdentity.path));
    afterTargetUnlink();
    return beforeUnlink2;
  });
  visibleState.entries = beforeUnlink.totalEntries;
  visibleState.ledger = beforeUnlink.ledger;
  ledger = beforeUnlink.ledger;
  metadata = await exactRemovalOperation(context, () => lstat2(quarantinePath, { bigint: true }));
  if (!sameStatIdentity(targetIdentity, metadata)) throw new Error("Exact cache cleanup quarantine identity changed after target unlink");
  assertSecureOwnerFileMetadata(metadata, quarantinePath, 1n);
  quarantineIdentity = fileIdentity(quarantinePath, locksIdentity, metadata);
  await validateExactRemovalArtifactForUse(
    layout,
    quarantinePath,
    quarantineIdentity,
    "quarantine",
    1n,
    hooks,
    context,
    visibleState.ledger
  );
  await syncExactOneLinkCacheFile(
    layout,
    quarantineIdentity,
    hooks,
    context,
    changesetRemovalRecoveryLimits.maxArtifactBytes,
    visibleState.ledger
  );
  return quarantineIdentity;
}
async function finishExactRemoval(layout, intentPath, intentIdentity, expectedIntentBytes, targetIdentity, quarantinePath, hooks, context, ledger, visibleState) {
  const intentHandle = await acquireExactRemovalResource(
    context,
    hooks,
    intentPath,
    "file",
    () => open2(intentPath, "r+")
  );
  let quarantineIdentity;
  try {
    const intentMetadata = await exactRemovalOperation(context, () => intentHandle.stat({ bigint: true }));
    if (!sameStatIdentity(intentIdentity, intentMetadata)) throw new Error("Exact-removal intent identity changed before recovery");
    assertSecureOwnerFileMetadata(intentMetadata, intentPath, 1n);
    await validateExactOneLinkCacheFile(layout, intentIdentity, context);
    await validateExactRemovalParent(layout, targetIdentity, context);
    const locksIdentity = await exactRemovalOperation(context, () => capturePathIdentity(layout.locks, "directory"));
    const targetMetadata = await exactRemovalOperation(context, () => optionalLstat(targetIdentity.path));
    const quarantineMetadata = await exactRemovalOperation(context, () => optionalLstat(quarantinePath));
    if (targetMetadata && quarantineMetadata) {
      if (!sameStatIdentity(targetIdentity, targetMetadata) || !sameStatIdentity(targetIdentity, quarantineMetadata)) {
        throw new Error("Exact cache cleanup found mismatched target and quarantine claim evidence");
      }
      assertSecureOwnerFileMetadata(targetMetadata, targetIdentity.path, 2n);
      assertSecureOwnerFileMetadata(quarantineMetadata, quarantinePath, 2n);
      if (hooks.beforeExactRemovalUnlink) {
        await exactRemovalOperation(context, () => hooks.beforeExactRemovalUnlink(targetIdentity.path));
      }
      await validateExpectedExactRemovalIntent(
        layout,
        intentPath,
        intentIdentity,
        1n,
        expectedIntentBytes,
        targetIdentity,
        quarantinePath,
        hooks,
        context,
        ledger
      );
      const recoveryNeedsRescan = hooks.beforeExactRemovalUnlink !== void 0 || hasExactRemovalInspectionHooks(hooks);
      if (recoveryNeedsRescan) {
        await inspectExactRemovalJournal(layout, hooks, context);
      }
      const recoveredReservation = await withExactRemovalFinalWindow(context, async (finalContext) => {
        const recoveredReservation2 = recoveryNeedsRescan ? await inspectExactRemovalJournalFinal(layout, finalContext) : { totalEntries: visibleState.entries, physicalBytes: visibleState.ledger.total, ledger: visibleState.ledger };
        await inspectExpectedExactRemovalIntentFinal(
          layout,
          intentPath,
          intentIdentity,
          1n,
          expectedIntentBytes,
          targetIdentity,
          quarantinePath,
          finalContext,
          recoveredReservation2.ledger
        );
        const [currentTarget, currentQuarantine] = await Promise.all([
          exactRemovalOperation(finalContext, () => lstat2(targetIdentity.path, { bigint: true })),
          exactRemovalOperation(finalContext, () => lstat2(quarantinePath, { bigint: true }))
        ]);
        if (!sameStatIdentity(targetIdentity, currentTarget) || !sameStatIdentity(targetIdentity, currentQuarantine)) {
          throw new Error("Exact cache cleanup quarantine claim changed during recovery");
        }
        assertSecureOwnerFileMetadata(currentTarget, targetIdentity.path, 2n);
        assertSecureOwnerFileMetadata(currentQuarantine, quarantinePath, 2n);
        await exactRemovalOperation(finalContext, () => rm(targetIdentity.path));
        return recoveredReservation2;
      });
      visibleState.entries = recoveredReservation.totalEntries;
      visibleState.ledger = recoveredReservation.ledger;
      ledger = recoveredReservation.ledger;
      const settled = await exactRemovalOperation(context, () => lstat2(quarantinePath, { bigint: true }));
      assertSecureOwnerFileMetadata(settled, quarantinePath, 1n);
      quarantineIdentity = fileIdentity(quarantinePath, locksIdentity, settled);
      await validateExactRemovalArtifactForUse(
        layout,
        quarantinePath,
        quarantineIdentity,
        "quarantine",
        1n,
        hooks,
        context,
        ledger
      );
      await syncExactOneLinkCacheFile(
        layout,
        quarantineIdentity,
        hooks,
        context,
        changesetRemovalRecoveryLimits.maxArtifactBytes,
        ledger
      );
    } else if (targetMetadata) {
      if (!sameStatIdentity(targetIdentity, targetMetadata)) {
        throw new Error("Exact-removal intent target was replaced during recovery; preserving evidence");
      }
      assertSecureOwnerFileMetadata(targetMetadata, targetIdentity.path, 1n);
      if (quarantineMetadata) throw new Error("Exact cache cleanup found both target and quarantine evidence");
      quarantineIdentity = await quarantineExactRemovalTarget(
        layout,
        intentPath,
        intentIdentity,
        expectedIntentBytes,
        targetIdentity,
        quarantinePath,
        locksIdentity,
        hooks,
        context,
        ledger,
        visibleState,
        void 0,
        canReuseRecoveryReservation(hooks)
      );
    } else if (quarantineMetadata) {
      if (!sameStatIdentity(targetIdentity, quarantineMetadata)) {
        throw new Error("Exact cache cleanup quarantine identity changed; preserving recovery evidence");
      }
      assertSecureOwnerFileMetadata(quarantineMetadata, quarantinePath, 1n);
      quarantineIdentity = fileIdentity(quarantinePath, locksIdentity, quarantineMetadata);
      await validateExactRemovalArtifactForUse(
        layout,
        quarantinePath,
        quarantineIdentity,
        "quarantine",
        1n,
        hooks,
        context,
        ledger
      );
      await syncExactOneLinkCacheFile(
        layout,
        quarantineIdentity,
        hooks,
        context,
        changesetRemovalRecoveryLimits.maxArtifactBytes,
        ledger
      );
    }
    await exactRemovalOperation(context, () => intentHandle.sync());
    if (hooks.afterRemovalIntentFileSync) {
      await exactRemovalOperation(context, () => hooks.afterRemovalIntentFileSync(intentPath, "unlinked"));
    }
    await validateExpectedExactRemovalIntent(
      layout,
      intentPath,
      intentIdentity,
      1n,
      expectedIntentBytes,
      targetIdentity,
      quarantinePath,
      hooks,
      context,
      ledger
    );
    if (hooks.afterExactRemovalUnlink) {
      await exactRemovalOperation(context, () => hooks.afterExactRemovalUnlink(targetIdentity.path, intentPath));
    }
    await validateExpectedExactRemovalIntent(
      layout,
      intentPath,
      intentIdentity,
      1n,
      expectedIntentBytes,
      targetIdentity,
      quarantinePath,
      hooks,
      context,
      ledger
    );
    await exactRemovalOperation(context, () => syncPublicationDirectory(targetIdentity.parent, hooks));
    await exactRemovalOperation(context, () => syncPublicationDirectory(layout.locks, hooks));
    await validateExpectedExactRemovalIntent(
      layout,
      intentPath,
      intentIdentity,
      1n,
      expectedIntentBytes,
      targetIdentity,
      quarantinePath,
      hooks,
      context,
      ledger
    );
    if (quarantineIdentity) {
      const exactQuarantineIdentity = quarantineIdentity;
      await validateExactOneLinkCacheFile(layout, exactQuarantineIdentity, context);
      await exactRemovalOperation(context, () => rm(exactQuarantineIdentity.path));
      visibleState.entries -= 1;
      visibleState.ledger.release(exactQuarantineIdentity);
      await exactRemovalOperation(context, () => intentHandle.sync());
      await exactRemovalOperation(context, () => syncPublicationDirectory(layout.locks, hooks));
    }
    if (hooks.beforeExactRemovalCompletion) {
      await exactRemovalOperation(context, () => hooks.beforeExactRemovalCompletion(intentPath));
    }
    await validateExpectedExactRemovalIntent(
      layout,
      intentPath,
      intentIdentity,
      1n,
      expectedIntentBytes,
      targetIdentity,
      quarantinePath,
      hooks,
      context,
      ledger
    );
    await validateExactOneLinkCacheFile(layout, intentIdentity, context);
    const completedTarget = await exactRemovalOperation(context, () => optionalLstat(targetIdentity.path));
    const completedQuarantine = await exactRemovalOperation(context, () => optionalLstat(quarantinePath));
    if (completedTarget) {
      throw new Error("Exact-removal target was replaced before completion; preserving intent evidence");
    }
    if (completedQuarantine) {
      throw new Error("Exact-removal quarantine reappeared before completion; preserving intent evidence");
    }
    const completedIntent = await exactRemovalOperation(context, () => intentHandle.stat({ bigint: true }));
    if (!sameStatIdentity(intentIdentity, completedIntent)) {
      throw new Error("Exact-removal intent epoch changed before completion");
    }
    assertSecureOwnerFileMetadata(completedIntent, intentPath, 1n);
  } catch (primaryError) {
    return closeExactRemovalResourceAfterError(intentHandle, intentPath, "file", hooks, primaryError);
  }
  await closeExactRemovalResource(intentHandle, intentPath, "file", hooks);
  await removeExactRemovalIntent(layout, intentIdentity, hooks, context);
  visibleState.entries -= 1;
  visibleState.ledger.release(intentIdentity);
}
async function scanExactRemovalJournal(layout, hooks, context, invokeHooks = true) {
  const operationHooks = invokeHooks ? hooks : { removalRecoveryNow: hooks.removalRecoveryNow };
  await exactRemovalOperation(context, () => validateCacheDirectoryChain(layout.root, layout.locks));
  const entryBudget = new CounterBudget("Exact-removal lock-directory entries", changesetRemovalRecoveryLimits.maxEntries);
  const artifacts = [];
  let totalEntries = 0;
  await withExactRemovalResource(
    context,
    operationHooks,
    layout.locks,
    "directory",
    () => opendir2(layout.locks),
    async (directory) => {
      for await (const entry of directory) {
        entryBudget.consume();
        exactRemovalStep(context);
        totalEntries += 1;
        const candidate = exactRemovalCandidatePattern.exec(entry.name);
        const intent = exactRemovalIntentPattern.test(entry.name) ? entry.name.slice(".remove-".length, -".json".length) : void 0;
        const quarantine = exactRemovalQuarantinePattern.exec(entry.name);
        const legacyQuarantine = legacyExactRemovalQuarantinePattern.test(entry.name) ? entry.name.slice(".removed-".length, -".data".length) : void 0;
        if (!candidate && !intent && !quarantine && !legacyQuarantine) continue;
        if (!entry.isFile()) throw new Error(`Exact-removal recovery artifact is not an ordinary file: ${entry.name}`);
        const path = join(layout.locks, entry.name);
        const identity = await exactRemovalOperation(context, () => capturePathIdentity(path, "file"));
        const metadata = await exactRemovalOperation(context, () => lstat2(path, { bigint: true }));
        const kind = candidate ? "candidate" : intent ? "intent" : quarantine ? "quarantine" : "legacy-quarantine";
        if (metadata.size > BigInt(exactRemovalArtifactMaxBytes(kind))) {
          throw new Error(`Exact-removal ${kind} exceeds its byte limit`);
        }
        assertSecureOwnerFileMetadata(metadata, path, metadata.nlink);
        if ((kind === "quarantine" || kind === "legacy-quarantine") && metadata.nlink !== 1n && metadata.nlink !== 2n) {
          throw new Error("Exact-removal quarantine has an unexpected hard-link count");
        }
        artifacts.push({
          name: entry.name,
          path,
          identity,
          metadata,
          kind,
          removalId: candidate?.[1] ?? intent ?? quarantine?.[1] ?? legacyQuarantine,
          ...quarantine ? { quarantineBinding: { dev: quarantine[2], ino: quarantine[3] } } : {}
        });
      }
    }
  );
  return { artifacts, totalEntries };
}
async function scanExactRemovalJournalFinal(layout, context) {
  await exactRemovalOperation(context, () => validateCacheDirectoryChain(layout.root, layout.locks));
  const entryBudget = new CounterBudget("Exact-removal lock-directory entries", changesetRemovalRecoveryLimits.maxEntries);
  const artifacts = [];
  let totalEntries = 0;
  await withExactRemovalFinalResource(
    context,
    "directory",
    () => opendir2(layout.locks),
    async (directory) => {
      for await (const entry of directory) {
        entryBudget.consume();
        exactRemovalStep(context);
        totalEntries += 1;
        const candidate = exactRemovalCandidatePattern.exec(entry.name);
        const intent = exactRemovalIntentPattern.test(entry.name) ? entry.name.slice(".remove-".length, -".json".length) : void 0;
        const quarantine = exactRemovalQuarantinePattern.exec(entry.name);
        const legacyQuarantine = legacyExactRemovalQuarantinePattern.test(entry.name) ? entry.name.slice(".removed-".length, -".data".length) : void 0;
        if (!candidate && !intent && !quarantine && !legacyQuarantine) continue;
        if (!entry.isFile()) throw new Error(`Exact-removal recovery artifact is not an ordinary file: ${entry.name}`);
        const path = join(layout.locks, entry.name);
        const identity = await exactRemovalOperation(context, () => capturePathIdentity(path, "file"));
        const metadata = await exactRemovalOperation(context, () => lstat2(path, { bigint: true }));
        const kind = candidate ? "candidate" : intent ? "intent" : quarantine ? "quarantine" : "legacy-quarantine";
        if (metadata.size > BigInt(exactRemovalArtifactMaxBytes(kind))) {
          throw new Error(`Exact-removal ${kind} exceeds its byte limit`);
        }
        assertSecureOwnerFileMetadata(metadata, path, metadata.nlink);
        if ((kind === "quarantine" || kind === "legacy-quarantine") && metadata.nlink !== 1n && metadata.nlink !== 2n) {
          throw new Error("Exact-removal quarantine has an unexpected hard-link count");
        }
        artifacts.push({
          name: entry.name,
          path,
          identity,
          metadata,
          kind,
          removalId: candidate?.[1] ?? intent ?? quarantine?.[1] ?? legacyQuarantine,
          ...quarantine ? { quarantineBinding: { dev: quarantine[2], ino: quarantine[3] } } : {}
        });
      }
    }
  );
  return { artifacts, totalEntries };
}
async function settleLostIntentTwoLinkQuarantine(layout, quarantine, hooks, context, ledger) {
  if (!quarantine.quarantineBinding || quarantine.metadata.nlink !== 2n) {
    throw new Error("Lost exact-removal intent does not have a bound two-link quarantine claim");
  }
  if (String(quarantine.identity.dev) !== quarantine.quarantineBinding.dev || String(quarantine.identity.ino) !== quarantine.quarantineBinding.ino) {
    throw new Error("Exact-removal quarantine identity does not match its durable filename binding");
  }
  const noMutationHooks = { removalRecoveryNow: hooks.removalRecoveryNow };
  const pendingDirectories = [layout.changesets, layout.snapshots, layout.indexes];
  const matches = [];
  while (pendingDirectories.length > 0) {
    const directoryPath = pendingDirectories.pop();
    await exactRemovalOperation(context, () => validateCacheDirectoryChain(layout.root, directoryPath));
    const directoryIdentity = await exactRemovalOperation(context, () => capturePathIdentity(directoryPath, "directory"));
    await withExactRemovalResource(
      context,
      noMutationHooks,
      directoryPath,
      "directory",
      () => opendir2(directoryPath),
      async (directory) => {
        for await (const entry of directory) {
          exactRemovalStep(context);
          const path = join(directoryPath, entry.name);
          if (entry.isSymbolicLink()) throw new Error("Lost-intent recovery encountered a symbolic-link cache entry");
          if (entry.isDirectory()) {
            pendingDirectories.push(path);
            continue;
          }
          if (!entry.isFile()) throw new Error("Lost-intent recovery encountered a non-regular cache entry");
          const metadata = await exactRemovalOperation(context, () => lstat2(path, { bigint: true }));
          if (metadata.dev !== BigInt(quarantine.quarantineBinding.dev) || metadata.ino !== BigInt(quarantine.quarantineBinding.ino)) continue;
          assertSecureOwnerFileMetadata(metadata, path, 2n);
          matches.push(fileIdentity(path, directoryIdentity, metadata));
          if (matches.length > 1) {
            throw new Error("Lost-intent quarantine has multiple managed target links; preserving ambiguous evidence");
          }
        }
      }
    );
  }
  if (matches.length !== 1) {
    throw new Error("Lost-intent quarantine has no unique managed target link; preserving recovery evidence");
  }
  const targetIdentity = matches[0];
  await withExactRemovalFinalWindow(context, async (finalContext) => {
    await validateExactCacheFile(layout, targetIdentity, 2n, finalContext);
    await validateExactCacheFile(layout, quarantine.identity, 2n, finalContext);
    const [targetMetadata, quarantineMetadata] = await Promise.all([
      exactRemovalOperation(finalContext, () => lstat2(targetIdentity.path, { bigint: true })),
      exactRemovalOperation(finalContext, () => lstat2(quarantine.path, { bigint: true }))
    ]);
    if (!sameStatIdentity(targetIdentity, targetMetadata) || !sameStatIdentity(quarantine.identity, quarantineMetadata) || !sameStatIdentity(targetIdentity, quarantineMetadata)) {
      throw new Error("Lost-intent target or quarantine identity changed before exact unlink");
    }
    assertSecureOwnerFileMetadata(targetMetadata, targetIdentity.path, 2n);
    assertSecureOwnerFileMetadata(quarantineMetadata, quarantine.path, 2n);
    await exactRemovalOperation(finalContext, () => rm(targetIdentity.path));
    const settled = await exactRemovalOperation(finalContext, () => lstat2(quarantine.path, { bigint: true }));
    if (!sameStatIdentity(quarantine.identity, settled)) {
      throw new Error("Lost-intent quarantine identity changed after exact target unlink");
    }
    assertSecureOwnerFileMetadata(settled, quarantine.path, 1n);
    await syncExactOneLinkCacheFileFinal(
      layout,
      quarantine.identity,
      finalContext,
      changesetRemovalRecoveryLimits.maxArtifactBytes,
      ledger
    );
    await syncExactRemovalDirectoryFinal(targetIdentity.parent, finalContext);
    await syncExactRemovalDirectoryFinal(layout.locks, finalContext);
    const durable = await exactRemovalOperation(finalContext, () => lstat2(quarantine.path, { bigint: true }));
    if (!sameStatIdentity(quarantine.identity, durable)) {
      throw new Error("Lost-intent quarantine identity changed during durable settlement");
    }
    assertSecureOwnerFileMetadata(durable, quarantine.path, 1n);
    await exactRemovalOperation(finalContext, () => rm(quarantine.path));
    await syncExactRemovalDirectoryFinal(layout.locks, finalContext);
    if (await exactRemovalOperation(finalContext, () => optionalLstat(quarantine.path))) {
      throw new Error("Lost-intent quarantine reappeared after exact deletion");
    }
  });
}
async function reconcileExactRemovalIntentsUnlocked(layout, hooks, context) {
  const { artifacts, totalEntries } = await scanExactRemovalJournal(layout, hooks, context);
  const ledger = new ExactRemovalByteLedger();
  for (const artifact of artifacts) {
    exactRemovalStep(context);
    if (artifact.metadata.nlink !== 1n && artifact.metadata.nlink !== 2n) {
      throw new Error("Exact-removal journal artifact has an ambiguous hard-link count");
    }
    await validateExactRemovalArtifactForUse(
      layout,
      artifact.path,
      artifact.identity,
      artifact.kind,
      artifact.metadata.nlink,
      hooks,
      context,
      ledger
    );
  }
  const visibleState = { entries: totalEntries, ledger };
  const candidates = artifacts.filter((artifact) => artifact.kind === "candidate").sort((left, right) => left.name.localeCompare(right.name, "en-US"));
  const intents = artifacts.filter((artifact) => artifact.kind === "intent").sort((left, right) => left.name.localeCompare(right.name, "en-US"));
  const quarantines = artifacts.filter((artifact) => artifact.kind === "quarantine" || artifact.kind === "legacy-quarantine").sort((left, right) => left.name.localeCompare(right.name, "en-US"));
  const intentById = new Map(intents.map((artifact) => [artifact.removalId, artifact]));
  const parsedIntents = /* @__PURE__ */ new Map();
  let retainedEntries = 0;
  const retainedArtifacts = [];
  const retain = (artifact) => {
    retainedEntries += 1;
    retainedArtifacts.push(artifact);
  };
  for (const candidate of candidates) {
    exactRemovalStep(context);
    const intent = intentById.get(candidate.removalId);
    if (candidate.metadata.nlink === 1n) {
      if (intent) throw new Error("Exact-removal candidate does not match the occupied final intent");
      const metadata = await validateExactRemovalArtifactForUse(
        layout,
        candidate.path,
        candidate.identity,
        "candidate",
        1n,
        hooks,
        context,
        ledger
      );
      if (Date.now() - Number(metadata.mtimeMs) >= changesetLifetimeMs) {
        await validateExactOneLinkCacheFile(layout, candidate.identity, context);
        await exactRemovalOperation(context, () => rm(candidate.path));
        visibleState.entries -= 1;
        visibleState.ledger.release(candidate.identity);
        await exactRemovalOperation(context, () => syncPublicationDirectory(layout.locks, hooks));
      } else {
        retain(candidate);
      }
      continue;
    }
    if (candidate.metadata.nlink !== 2n || !intent || intent.metadata.nlink !== 2n || !sameStatIdentity(candidate.identity, intent.metadata)) {
      throw new Error("Exact-removal candidate publication identity is ambiguous");
    }
    await validateExactRemovalArtifactForUse(
      layout,
      candidate.path,
      candidate.identity,
      "candidate",
      2n,
      hooks,
      context,
      ledger
    );
    const parsed = await readExactRemovalIntent(
      layout,
      intent.path,
      intent.identity,
      2n,
      hooks,
      context,
      ledger
    );
    if (!sameObjectIdentity(candidate.identity, parsed.intentIdentity)) {
      throw new Error("Exact-removal candidate and final intent identity changed before recovery parsing");
    }
    parsedIntents.set(intent.removalId, parsed);
    await validateExactCacheFile(layout, candidate.identity, 2n, context);
    await exactRemovalOperation(context, () => rm(candidate.path));
    visibleState.entries -= 1;
    await syncExactOneLinkCacheFile(
      layout,
      intent.identity,
      hooks,
      context,
      maximumExactRemovalIntentBytes,
      ledger
    );
    await exactRemovalOperation(context, () => syncPublicationDirectory(layout.locks, hooks));
  }
  for (const intent of intents) {
    exactRemovalStep(context);
    if (!await exactRemovalOperation(context, () => optionalLstat(intent.path))) continue;
    const { intentIdentity, targetIdentity, quarantinePath, bytes } = parsedIntents.get(intent.removalId) ?? await readExactRemovalIntent(layout, intent.path, intent.identity, 1n, hooks, context, ledger);
    const targetMetadata = await exactRemovalOperation(context, () => optionalLstat(targetIdentity.path));
    if (targetMetadata) {
      if (!sameStatIdentity(targetIdentity, targetMetadata)) {
        throw new Error("Exact-removal intent target was replaced; preserving cleanup evidence");
      }
      if (targetMetadata.nlink !== 1n && targetMetadata.nlink !== 2n) {
        throw new Error("Exact-removal intent target has an ambiguous hard-link count");
      }
      assertSecureOwnerFileMetadata(targetMetadata, targetIdentity.path, targetMetadata.nlink);
    }
    if (hooks.beforeExactRemovalRecovery) {
      await exactRemovalOperation(context, () => hooks.beforeExactRemovalRecovery(intentIdentity.path));
    }
    await validateExpectedExactRemovalIntent(
      layout,
      intentIdentity.path,
      intentIdentity,
      1n,
      bytes,
      targetIdentity,
      quarantinePath,
      hooks,
      context,
      ledger
    );
    await finishExactRemoval(
      layout,
      intentIdentity.path,
      intentIdentity,
      bytes,
      targetIdentity,
      quarantinePath,
      hooks,
      context,
      ledger,
      visibleState
    );
  }
  for (const quarantine of quarantines) {
    exactRemovalStep(context);
    if (!await exactRemovalOperation(context, () => optionalLstat(quarantine.path))) continue;
    const metadata = await validateExactRemovalArtifactForUse(
      layout,
      quarantine.path,
      quarantine.identity,
      quarantine.kind,
      BigInt(quarantine.metadata.nlink),
      hooks,
      context,
      ledger
    );
    if (!quarantine.quarantineBinding) {
      retain(quarantine);
      continue;
    }
    if (String(quarantine.identity.dev) !== quarantine.quarantineBinding.dev || String(quarantine.identity.ino) !== quarantine.quarantineBinding.ino) {
      throw new Error("Exact-removal quarantine identity does not match its durable filename binding; preserving replacement evidence");
    }
    if (metadata.nlink === 2n) {
      await settleLostIntentTwoLinkQuarantine(layout, quarantine, hooks, context, ledger);
      visibleState.entries -= 1;
      visibleState.ledger.release(quarantine.identity);
      continue;
    }
    const quarantineIdentity = quarantine.identity;
    await syncExactOneLinkCacheFile(
      layout,
      quarantineIdentity,
      hooks,
      context,
      changesetRemovalRecoveryLimits.maxArtifactBytes,
      ledger
    );
    await validateExactOneLinkCacheFile(layout, quarantineIdentity, context);
    await exactRemovalOperation(context, () => rm(quarantine.path));
    visibleState.entries -= 1;
    visibleState.ledger.release(quarantineIdentity);
    await exactRemovalOperation(context, () => syncPublicationDirectory(layout.locks, hooks));
  }
  for (const artifact of retainedArtifacts) {
    await validateExactRemovalArtifactForUse(
      layout,
      artifact.path,
      artifact.identity,
      artifact.kind,
      1n,
      hooks,
      context,
      ledger
    );
  }
  const retainedSizes = /* @__PURE__ */ new Map();
  for (const artifact of retainedArtifacts) {
    const metadata = await validateExactRemovalArtifactForUse(
      layout,
      artifact.path,
      artifact.identity,
      artifact.kind,
      1n,
      hooks,
      context,
      ledger,
      false
    );
    retainedSizes.set(`${artifact.identity.dev}:${artifact.identity.ino}`, Number(metadata.size));
  }
  return {
    usage: {
      retainedEntries,
      retainedBytes: [...retainedSizes.values()].reduce((total, size) => total + size, 0)
    },
    visibleState
  };
}
async function reconcileExactRemovalIntents(layout, hooks = {}) {
  return withExactRemovalJournalLock(layout.locks, async () => (await reconcileExactRemovalIntentsUnlocked(layout, hooks, createExactRemovalOperationContext(hooks))).usage);
}
async function inspectExactRemovalJournal(layout, hooks, context, invokeHooks = true) {
  const scan2 = await scanExactRemovalJournal(layout, hooks, context, invokeHooks);
  const operationHooks = invokeHooks ? hooks : { removalRecoveryNow: hooks.removalRecoveryNow };
  const ledger = new ExactRemovalByteLedger();
  for (const artifact of scan2.artifacts.sort((left, right) => left.name.localeCompare(right.name, "en-US"))) {
    exactRemovalStep(context);
    if (artifact.metadata.nlink !== 1n && artifact.metadata.nlink !== 2n) {
      throw new Error("Exact-removal journal artifact has an ambiguous hard-link count");
    }
    await validateExactRemovalArtifactForUse(
      layout,
      artifact.path,
      artifact.identity,
      artifact.kind,
      artifact.metadata.nlink,
      operationHooks,
      context,
      ledger,
      invokeHooks
    );
  }
  return { totalEntries: scan2.totalEntries, physicalBytes: ledger.total, ledger };
}
async function inspectExactRemovalJournalFinal(layout, context) {
  const scan2 = await scanExactRemovalJournalFinal(layout, context);
  const ledger = new ExactRemovalByteLedger();
  for (const artifact of scan2.artifacts.sort((left, right) => left.name.localeCompare(right.name, "en-US"))) {
    exactRemovalStep(context);
    if (artifact.metadata.nlink !== 1n && artifact.metadata.nlink !== 2n) {
      throw new Error("Exact-removal journal artifact has an ambiguous hard-link count");
    }
    await validateExactRemovalArtifactForUseFinal(
      layout,
      artifact.path,
      artifact.identity,
      artifact.kind,
      artifact.metadata.nlink,
      context,
      ledger
    );
  }
  return { totalEntries: scan2.totalEntries, physicalBytes: ledger.total, ledger };
}
function assertExactRemovalJournalHeadroom(currentEntries, additionalEntries, currentBytes, additionalBytes) {
  if (currentEntries + additionalEntries > changesetRemovalRecoveryLimits.maxEntries) {
    throw new Error(
      `Exact-removal journal cannot reserve ${additionalEntries} entry headroom within ${changesetRemovalRecoveryLimits.maxEntries} entries`
    );
  }
  if (currentBytes + additionalBytes > changesetRemovalRecoveryLimits.maxBytes) {
    throw new Error(
      `Exact-removal journal cannot reserve byte headroom within ${changesetRemovalRecoveryLimits.maxBytes} bytes`
    );
  }
}
async function inspectExactRemovalTargetSize(layout, identity, hooks, context, invokeHooks = true) {
  const operationHooks = invokeHooks ? hooks : { removalRecoveryNow: hooks.removalRecoveryNow };
  await validateExactRemovalParent(layout, identity, context);
  const metadata = await withExactRemovalResource(
    context,
    operationHooks,
    identity.path,
    "file",
    () => open2(identity.path, "r"),
    async (handle) => {
      const observed = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(identity, observed)) throw new Error("Exact-removal target identity changed before reservation");
      assertSecureOwnerFileMetadata(observed, identity.path, 1n);
      if (observed.size > BigInt(changesetRemovalRecoveryLimits.maxArtifactBytes)) {
        throw new Error("Exact-removal target exceeds its artifact byte limit");
      }
      return observed;
    }
  );
  const finalMetadata = await exactRemovalOperation(context, () => lstat2(identity.path, { bigint: true }));
  if (!sameStatIdentity(identity, finalMetadata) || finalMetadata.size !== metadata.size) {
    throw new Error("Exact-removal target changed during reservation validation");
  }
  assertSecureOwnerFileMetadata(finalMetadata, identity.path, 1n);
  return Number(finalMetadata.size);
}
async function inspectExactRemovalTargetSizeFinal(layout, identity, context) {
  await validateExactRemovalParent(layout, identity, context);
  const metadata = await withExactRemovalFinalResource(
    context,
    "file",
    () => open2(identity.path, "r"),
    async (handle) => {
      const observed = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
      if (!sameStatIdentity(identity, observed)) throw new Error("Exact-removal target identity changed before final reservation");
      assertSecureOwnerFileMetadata(observed, identity.path, 1n);
      if (observed.size > BigInt(changesetRemovalRecoveryLimits.maxArtifactBytes)) {
        throw new Error("Exact-removal target exceeds its artifact byte limit");
      }
      return observed;
    }
  );
  const finalMetadata = await exactRemovalOperation(context, () => lstat2(identity.path, { bigint: true }));
  if (!sameStatIdentity(identity, finalMetadata) || finalMetadata.size !== metadata.size) {
    throw new Error("Exact-removal target changed during final reservation validation");
  }
  assertSecureOwnerFileMetadata(finalMetadata, identity.path, 1n);
  return Number(finalMetadata.size);
}
async function writeAllExactRemovalBytes(handle, bytes, start, end, hooks, context) {
  let offset = start;
  while (offset < end) {
    const length = end - offset;
    const bytesWritten = await exactRemovalOperation(context, async () => hooks.writeRemovalIntentChunk ? hooks.writeRemovalIntentChunk(handle, bytes, offset, length, offset) : (await handle.write(bytes, offset, length, offset)).bytesWritten);
    if (!Number.isSafeInteger(bytesWritten) || bytesWritten < 0 || bytesWritten > length) {
      throw new Error("Exact-removal intent writer returned an invalid bounded byte count");
    }
    if (bytesWritten === 0) throw new Error("Exact-removal intent writer made zero-byte progress");
    offset += bytesWritten;
  }
}
async function writeAllExactRemovalBytesFinal(handle, bytes, context, start = 0, end = bytes.byteLength) {
  let offset = start;
  while (offset < end) {
    const length = end - offset;
    const bytesWritten = await exactRemovalOperation(
      context,
      async () => (await handle.write(bytes, offset, length, offset)).bytesWritten
    );
    if (!Number.isSafeInteger(bytesWritten) || bytesWritten < 0 || bytesWritten > length) {
      throw new Error("Exact-removal final intent writer returned an invalid bounded byte count");
    }
    if (bytesWritten === 0) throw new Error("Exact-removal final intent writer made zero-byte progress");
    offset += bytesWritten;
  }
}
async function validateWrittenExactRemovalCandidate(handle, candidateIdentity, candidatePath, bytes, context) {
  const metadata = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
  if (!sameStatIdentity(candidateIdentity, metadata) || metadata.size !== BigInt(bytes.byteLength)) {
    throw new Error("Exact-removal candidate size or identity changed after bounded write");
  }
  assertSecureOwnerFileMetadata(metadata, candidatePath, 1n);
  const observed = Buffer.alloc(bytes.byteLength);
  let offset = 0;
  while (offset < observed.byteLength) {
    const bytesRead = await exactRemovalOperation(
      context,
      async () => (await handle.read(observed, offset, observed.byteLength - offset, offset)).bytesRead
    );
    if (bytesRead === 0) throw new Error("Exact-removal candidate ended before its exact written length");
    offset += bytesRead;
  }
  const eof = Buffer.alloc(1);
  const eofBytes = await exactRemovalOperation(
    context,
    async () => (await handle.read(eof, 0, 1, observed.byteLength)).bytesRead
  );
  if (eofBytes !== 0 || !observed.equals(bytes)) {
    throw new Error("Exact-removal candidate bytes or EOF do not match the complete intent");
  }
  const after = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
  if (!sameStatIdentity(candidateIdentity, after) || after.size !== BigInt(bytes.byteLength)) {
    throw new Error("Exact-removal candidate changed during complete-byte verification");
  }
  assertSecureOwnerFileMetadata(after, candidatePath, 1n);
  const finalMetadata = await exactRemovalOperation(context, () => lstat2(candidatePath, { bigint: true }));
  if (!sameStatIdentity(candidateIdentity, finalMetadata) || finalMetadata.size !== BigInt(bytes.byteLength)) {
    throw new Error("Exact-removal candidate final path changed before publication");
  }
  assertSecureOwnerFileMetadata(finalMetadata, candidatePath, 1n);
}
async function safeRemoveExactCacheFile(layout, identity, hooks = {}) {
  return withExactRemovalJournalLock(layout.locks, () => safeRemoveExactCacheFileUnlocked(layout, identity, hooks, createExactRemovalOperationContext(hooks)));
}
async function safeRemoveExactCacheFileUnlocked(layout, identity, hooks, context) {
  if (identity.kind !== "file") throw new Error("Exact cache cleanup identity must describe a file");
  await reconcileExactRemovalIntentsUnlocked(layout, hooks, context);
  await validateExactRemovalParent(layout, identity, context);
  await validateExactOneLinkCacheFile(layout, identity, context);
  await inspectExactRemovalTargetSize(layout, identity, hooks, context);
  const locksIdentity = await exactRemovalOperation(context, () => capturePathIdentity(layout.locks, "directory"));
  const removalId = randomUUID();
  const intentPath = join(layout.locks, `.remove-${removalId}.json`);
  const candidatePath = join(layout.locks, `.remove-${removalId}.owner-${randomUUID()}.tmp`);
  const quarantinePath = join(layout.locks, `.removed-${removalId}-${identity.dev}-${identity.ino}.data`);
  const bytes = Buffer.from(`${JSON.stringify(exactRemovalIntent(identity, quarantinePath))}
`, "utf8");
  if (bytes.byteLength > maximumExactRemovalIntentBytes) throw new Error("Exact-removal intent exceeds its byte limit");
  let intentIdentity;
  let candidateIdentity;
  let intentPublished = false;
  let handle;
  let handlePath = candidatePath;
  let targetUnlinked = false;
  let preserveCandidateEvidence = false;
  let visibleState;
  const publishIntentInCandidateFinalWindow = hooks.writeRemovalIntentChunk === void 0 && hooks.duringRemovalIntentCandidateWrite === void 0 && hooks.beforeRemovalIntentLink === void 0 && !hasExactRemovalInspectionHooks(hooks);
  try {
    const candidateReservation = await withExactRemovalFinalWindow(context, async (finalContext) => {
      const reservation = await inspectExactRemovalJournalFinal(layout, finalContext);
      const targetBytes = await inspectExactRemovalTargetSizeFinal(layout, identity, finalContext);
      assertExactRemovalJournalHeadroom(
        reservation.totalEntries,
        2,
        reservation.physicalBytes,
        bytes.byteLength + targetBytes
      );
      await exactRemovalOperation(finalContext, () => validateSecurePathIdentity(layout, locksIdentity));
      await validateExactOneLinkCacheFile(layout, identity, finalContext);
      const prepareCandidate = async (candidateHandle) => {
        const created = await exactRemovalOperation(finalContext, () => candidateHandle.stat({ bigint: true }));
        assertSecureOwnerFileMetadata(created, candidatePath, 1n);
        if (created.size !== 0n) throw new Error("Exact-removal candidate was not empty at exclusive creation");
        candidateIdentity = fileIdentity(candidatePath, locksIdentity, created);
        const visible = await exactRemovalOperation(finalContext, () => lstat2(candidatePath, { bigint: true }));
        if (!sameStatIdentity(candidateIdentity, visible) || visible.size !== 0n) {
          throw new Error("Exact-removal candidate identity changed at first visibility");
        }
        assertSecureOwnerFileMetadata(visible, candidatePath, 1n);
      };
      if (publishIntentInCandidateFinalWindow) {
        await withExactRemovalFinalResource(
          finalContext,
          "file",
          () => open2(candidatePath, "wx+", 384),
          async (candidateHandle) => {
            await prepareCandidate(candidateHandle);
            await writeAllExactRemovalBytesFinal(candidateHandle, bytes, finalContext);
            await exactRemovalOperation(finalContext, () => candidateHandle.sync());
            await validateWrittenExactRemovalCandidate(
              candidateHandle,
              candidateIdentity,
              candidatePath,
              bytes,
              finalContext
            );
            await exactRemovalOperation(finalContext, () => link(candidatePath, intentPath));
            intentPublished = true;
          }
        );
      } else {
        handle = await acquireExactRemovalFinalResource(
          finalContext,
          "file",
          () => open2(candidatePath, "wx+", 384)
        );
        await prepareCandidate(handle);
      }
      return reservation;
    });
    if (!candidateIdentity) {
      throw new Error("Exact-removal candidate creation did not produce an authenticated file");
    }
    const preparedCandidateIdentity = candidateIdentity;
    if (publishIntentInCandidateFinalWindow) {
      visibleState = { entries: candidateReservation.totalEntries + 2, ledger: candidateReservation.ledger };
    } else {
      if (!handle) throw new Error("Exact-removal candidate handle was not retained for hookful preparation");
      const split = Math.max(1, Math.floor(bytes.byteLength / 2));
      await writeAllExactRemovalBytes(handle, bytes, 0, split, hooks, context);
      if (hooks.duringRemovalIntentCandidateWrite) {
        preserveCandidateEvidence = true;
        await exactRemovalOperation(context, () => hooks.duringRemovalIntentCandidateWrite(candidatePath, intentPath));
        await withExactRemovalFinalWindow(context, async (finalContext) => {
          const reservation = await inspectExactRemovalJournalFinal(layout, finalContext);
          const partial = await exactRemovalOperation(finalContext, () => handle.stat({ bigint: true }));
          if (!sameStatIdentity(preparedCandidateIdentity, partial) || partial.size !== BigInt(split)) {
            throw new Error("Exact-removal partial candidate changed before remaining-byte reservation");
          }
          assertSecureOwnerFileMetadata(partial, candidatePath, 1n);
          await validateExactOneLinkCacheFile(layout, preparedCandidateIdentity, finalContext);
          const remainingBytes = bytes.byteLength - Number(partial.size);
          assertExactRemovalJournalHeadroom(
            reservation.totalEntries,
            0,
            reservation.physicalBytes,
            remainingBytes
          );
          await writeAllExactRemovalBytesFinal(
            handle,
            bytes,
            finalContext,
            Number(partial.size),
            bytes.byteLength
          );
          await exactRemovalOperation(finalContext, () => handle.sync());
          await validateWrittenExactRemovalCandidate(
            handle,
            preparedCandidateIdentity,
            candidatePath,
            bytes,
            finalContext
          );
        });
        preserveCandidateEvidence = false;
      } else {
        await writeAllExactRemovalBytes(handle, bytes, split, bytes.byteLength, hooks, context);
        await exactRemovalOperation(context, () => handle.sync());
        await validateWrittenExactRemovalCandidate(handle, preparedCandidateIdentity, candidatePath, bytes, context);
      }
      await closeExactRemovalResource(handle, candidatePath, "file", hooks);
      handle = void 0;
      await validateExactOneLinkCacheFile(layout, preparedCandidateIdentity, context);
      if (hooks.beforeRemovalIntentLink) {
        preserveCandidateEvidence = true;
        await exactRemovalOperation(context, () => hooks.beforeRemovalIntentLink(candidatePath, intentPath));
      }
      await withExactRemovalResource(
        context,
        hooks,
        candidatePath,
        "file",
        () => open2(candidatePath, "r"),
        async (candidateHandle) => validateWrittenExactRemovalCandidate(
          candidateHandle,
          preparedCandidateIdentity,
          candidatePath,
          bytes,
          context
        )
      );
      if (hasExactRemovalInspectionHooks(hooks)) {
        await inspectExactRemovalTargetSize(layout, identity, hooks, context);
        await inspectExactRemovalJournal(layout, hooks, context);
      }
      const beforeLink = await withExactRemovalFinalWindow(context, async (finalContext) => {
        const finalReservation = await inspectExactRemovalJournalFinal(layout, finalContext);
        const currentTargetBytes = await inspectExactRemovalTargetSizeFinal(layout, identity, finalContext);
        await exactRemovalOperation(finalContext, () => validateSecurePathIdentity(layout, locksIdentity));
        await withExactRemovalFinalResource(
          finalContext,
          "file",
          () => open2(candidatePath, "r"),
          async (candidateHandle) => validateWrittenExactRemovalCandidate(
            candidateHandle,
            preparedCandidateIdentity,
            candidatePath,
            bytes,
            finalContext
          )
        );
        await validateExactOneLinkCacheFile(layout, preparedCandidateIdentity, finalContext);
        preserveCandidateEvidence = false;
        assertExactRemovalJournalHeadroom(
          finalReservation.totalEntries,
          1,
          finalReservation.physicalBytes,
          currentTargetBytes
        );
        await exactRemovalOperation(finalContext, () => link(candidatePath, intentPath));
        return finalReservation;
      });
      intentPublished = true;
      visibleState = { entries: beforeLink.totalEntries + 1, ledger: beforeLink.ledger };
    }
    if (hooks.afterRemovalIntentLink) {
      await exactRemovalOperation(context, () => hooks.afterRemovalIntentLink(candidatePath, intentPath));
    }
    const candidateMetadata = await exactRemovalOperation(context, () => lstat2(candidatePath, { bigint: true }));
    const intentMetadata = await exactRemovalOperation(context, () => lstat2(intentPath, { bigint: true }));
    if (!sameStatIdentity(preparedCandidateIdentity, candidateMetadata) || !sameStatIdentity(preparedCandidateIdentity, intentMetadata)) {
      throw new Error("Published exact-removal intent identity does not match its synced candidate");
    }
    assertSecureOwnerFileMetadata(candidateMetadata, candidatePath, 2n);
    assertSecureOwnerFileMetadata(intentMetadata, intentPath, 2n);
    intentIdentity = fileIdentity(intentPath, locksIdentity, intentMetadata);
    await validateExpectedExactRemovalIntent(
      layout,
      intentPath,
      intentIdentity,
      2n,
      bytes,
      identity,
      quarantinePath,
      hooks,
      context,
      visibleState.ledger
    );
    await validateExactCacheFile(layout, preparedCandidateIdentity, 2n, context);
    await exactRemovalOperation(context, () => rm(candidatePath));
    visibleState.entries -= 1;
    await syncExactOneLinkCacheFile(
      layout,
      intentIdentity,
      hooks,
      context,
      maximumExactRemovalIntentBytes,
      visibleState.ledger
    );
    await exactRemovalOperation(context, () => syncPublicationDirectory(layout.locks, hooks));
    handlePath = intentPath;
    handle = await acquireExactRemovalResource(
      context,
      hooks,
      intentPath,
      "file",
      () => open2(intentPath, "r+")
    );
    const preparedIntentMetadata = await exactRemovalOperation(context, () => handle.stat({ bigint: true }));
    if (!sameStatIdentity(intentIdentity, preparedIntentMetadata)) {
      throw new Error("Exact-removal intent identity changed after candidate cleanup");
    }
    assertSecureOwnerFileMetadata(preparedIntentMetadata, intentPath, 1n);
    if (hooks.afterRemovalIntentFileSync) {
      await exactRemovalOperation(context, () => hooks.afterRemovalIntentFileSync(intentPath, "prepared"));
    }
    await validateExpectedExactRemovalIntent(
      layout,
      intentPath,
      intentIdentity,
      1n,
      bytes,
      identity,
      quarantinePath,
      hooks,
      context,
      visibleState.ledger
    );
    await quarantineExactRemovalTarget(
      layout,
      intentPath,
      intentIdentity,
      bytes,
      identity,
      quarantinePath,
      locksIdentity,
      hooks,
      context,
      visibleState.ledger,
      visibleState,
      () => {
        targetUnlinked = true;
      }
    );
    await exactRemovalOperation(context, () => handle.sync());
    if (hooks.afterRemovalIntentFileSync) {
      await exactRemovalOperation(context, () => hooks.afterRemovalIntentFileSync(intentPath, "unlinked"));
    }
    await validateExpectedExactRemovalIntent(
      layout,
      intentPath,
      intentIdentity,
      1n,
      bytes,
      identity,
      quarantinePath,
      hooks,
      context,
      visibleState.ledger
    );
    if (hooks.afterExactRemovalUnlink) {
      await exactRemovalOperation(context, () => hooks.afterExactRemovalUnlink(identity.path, intentPath));
    }
    await validateExpectedExactRemovalIntent(
      layout,
      intentPath,
      intentIdentity,
      1n,
      bytes,
      identity,
      quarantinePath,
      hooks,
      context,
      visibleState.ledger
    );
    await exactRemovalOperation(context, () => syncPublicationDirectory(identity.parent, hooks));
    await exactRemovalOperation(context, () => syncPublicationDirectory(layout.locks, hooks));
    await validateExpectedExactRemovalIntent(
      layout,
      intentPath,
      intentIdentity,
      1n,
      bytes,
      identity,
      quarantinePath,
      hooks,
      context,
      visibleState.ledger
    );
    const quarantineMetadata = await exactRemovalOperation(context, () => lstat2(quarantinePath, { bigint: true }));
    if (!sameStatIdentity(identity, quarantineMetadata)) throw new Error("Exact cache cleanup quarantine identity changed before unlink");
    assertSecureOwnerFileMetadata(quarantineMetadata, quarantinePath, 1n);
    const quarantineIdentity = fileIdentity(quarantinePath, locksIdentity, quarantineMetadata);
    await validateExactRemovalArtifactForUse(
      layout,
      quarantinePath,
      quarantineIdentity,
      "quarantine",
      1n,
      hooks,
      context,
      visibleState.ledger
    );
    await validateExactOneLinkCacheFile(layout, quarantineIdentity, context);
    await exactRemovalOperation(context, () => rm(quarantinePath));
    visibleState.entries -= 1;
    visibleState.ledger.release(quarantineIdentity);
    await exactRemovalOperation(context, () => handle.sync());
    await exactRemovalOperation(context, () => syncPublicationDirectory(layout.locks, hooks));
    await validateExpectedExactRemovalIntent(
      layout,
      intentPath,
      intentIdentity,
      1n,
      bytes,
      identity,
      quarantinePath,
      hooks,
      context,
      visibleState.ledger
    );
  } catch (primaryError) {
    let closeError;
    try {
      if (handle) await closeExactRemovalResource(handle, handlePath, "file", hooks);
    } catch (error) {
      closeError = error;
    }
    handle = void 0;
    if (targetUnlinked || intentPublished) {
      if (closeError !== void 0) {
        throw new AggregateError([primaryError, closeError], "Exact cache cleanup failed after unlink and intent close was ambiguous", { cause: primaryError });
      }
      throw primaryError;
    }
    let cleanupError = closeError;
    if (candidateIdentity && !preserveCandidateEvidence) {
      try {
        await validateExactOneLinkCacheFile(layout, candidateIdentity, context);
        await exactRemovalOperation(context, () => rm(candidateIdentity.path));
        await exactRemovalOperation(context, () => syncPublicationDirectory(candidateIdentity.parent, hooks));
      } catch (error) {
        cleanupError = cleanupError === void 0 ? error : new AggregateError([cleanupError, error]);
      }
    }
    if (cleanupError !== void 0) {
      throw new AggregateError(
        [primaryError, cleanupError],
        "Exact cache cleanup failed before unlink and intent cleanup was ambiguous",
        { cause: primaryError }
      );
    }
    throw primaryError;
  } finally {
    if (handle) await closeExactRemovalResource(handle, handlePath, "file", hooks);
  }
  if (!intentIdentity) throw new Error("Exact cache cleanup did not capture its durable intent identity");
  await removeExactRemovalIntent(layout, intentIdentity, hooks, context);
}
function earlyDirectoryIdentity(path, parent, metadata) {
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error(`Cache path is not an ordinary directory: ${path}`);
  return {
    path,
    parent: parent.path,
    dev: metadata.dev,
    ino: metadata.ino,
    kind: "directory",
    parentDev: parent.dev,
    parentIno: parent.ino
  };
}
async function removeExactEmptyCreatedDirectory(identity) {
  const metadata = await optionalLstat(identity.path);
  if (!metadata) throw new Error(`Owned directory cleanup could not find the exact created identity; retained path is ambiguous: ${identity.path}`);
  if (metadata.isSymbolicLink() || !metadata.isDirectory() || !sameStatIdentity(identity, metadata)) {
    throw new Error(`Owned directory cleanup retained exact path after identity changed: ${identity.path}`);
  }
  await rmdir(identity.path);
}
async function createOwnedDirectoryExact(layout, path, parentIdentity, hooks) {
  let created = false;
  let identity;
  let primaryError;
  try {
    await validateSecurePathIdentity(layout, parentIdentity);
    await mkdir(path, { mode: 448 });
    created = true;
    identity = earlyDirectoryIdentity(path, parentIdentity, await lstat2(path, { bigint: true }));
    await hooks.afterMkdir?.(identity);
    const immediatelyBeforeRepair = await lstat2(path, { bigint: true });
    if (!sameStatIdentity(identity, immediatelyBeforeRepair)) throw new Error(`Owned directory identity changed after creation: ${path}`);
    await enforceOwnerDirectoryMetadata(path);
    await validateSecurePathIdentity(layout, parentIdentity);
    const completed = await capturePathIdentity(path, "directory");
    if (!sameObjectIdentity(identity, completed) || completed.parentDev !== parentIdentity.dev || completed.parentIno !== parentIdentity.ino || !sameFilesystemPath(completed.parent, parentIdentity.path)) {
      throw new Error(`Owned directory or parent identity changed during creation: ${path}`);
    }
    return completed;
  } catch (error) {
    primaryError = error;
  }
  if (!created) throw primaryError;
  let cleanupError;
  if (!identity) {
    cleanupError = new Error(`Owned directory identity could not be recorded; exact path retained: ${path}`);
  } else {
    try {
      await removeExactEmptyCreatedDirectory(identity);
    } catch (error) {
      cleanupError = error;
    }
  }
  if (cleanupError !== void 0) {
    throw new AggregateError(
      [primaryError, cleanupError],
      `Owned directory creation failed and cleanup was ambiguous: ${path}`,
      { cause: primaryError }
    );
  }
  throw primaryError;
}
async function createOwnedBuildDirectory(layout, parent, hooks = {}) {
  const canonicalParent = await createSecureCacheDirectory(layout, parent);
  const parentIdentity = await capturePathIdentity(canonicalParent, "directory");
  for (; ; ) {
    const path = join(canonicalParent, `.build-${randomUUID()}`);
    try {
      return await createOwnedDirectoryExact(layout, path, parentIdentity, hooks);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
}
async function claimOwnedSnapshotDirectory(layout, path, hooks = {}) {
  const target = assertCacheChild(layout, path, "directory");
  if (!isStrictlyInside(layout.indexes, target) || !/^[a-f0-9]{64}$/iu.test(basename(target))) {
    throw new Error("Snapshot claim path is not an owned index snapshot target");
  }
  const parent = await createSecureCacheDirectory(layout, dirname2(target));
  const parentIdentity = await capturePathIdentity(parent, "directory");
  return createPublicationClaim(layout, target, parentIdentity, hooks);
}
async function safeRemoveOwnedPublicationClaim(layout, identity, hooks = {}) {
  await safeRemovePublicationClaim(layout, identity, true, hooks);
}
async function observeOwnedSnapshotPublicationClaim(layout, targetPath, hooks = {}) {
  const target = assertCacheChild(layout, targetPath, "directory");
  if (!isStrictlyInside(layout.indexes, target) || !/^[a-f0-9]{64}$/iu.test(basename(target))) {
    throw new Error("Snapshot publication target is invalid");
  }
  return observePublicationClaim(layout, target, hooks);
}
async function publishOwnedBuildDirectory(layout, build, targetPath, claim, hooks = {}) {
  if (build.kind !== "directory" || claim.kind !== "file") throw new Error("Snapshot build and publication-claim identities have invalid types");
  const target = assertCacheChild(layout, targetPath, "directory");
  if (!isStrictlyInside(layout.indexes, target) || !/^[a-f0-9]{64}$/iu.test(basename(target))) {
    throw new Error("Snapshot publication target is invalid");
  }
  if (!sameFilesystemPath(claim.path, publicationClaimPath(target))) throw new Error("Snapshot publication claim path is invalid");
  if (!sameFilesystemPath(build.parent, dirname2(target)) || !sameFilesystemPath(claim.parent, dirname2(target))) {
    throw new Error("Snapshot publication identities do not share the target parent");
  }
  if (await optionalLstat(target)) throw Object.assign(new Error("Snapshot publication target already exists"), { code: "EEXIST" });
  const parent = await capturePathIdentity(dirname2(target), "directory");
  if (parent.dev !== build.parentDev || parent.ino !== build.parentIno || parent.dev !== claim.parentDev || parent.ino !== claim.parentIno) {
    throw new Error("Snapshot publication parent identity changed");
  }
  await validateSecurePathIdentity(layout, build);
  await validatePublicationClaim(layout, claim);
  await validateSecurePathIdentity(layout, parent);
  if (await optionalLstat(target)) throw Object.assign(new Error("Snapshot publication target already exists"), { code: "EEXIST" });
  await rename(build.path, target);
  const renamedIdentity = { ...build, path: target, parent: dirname2(target) };
  let primaryError;
  try {
    await hooks.afterRename?.(target);
    const published = await capturePathIdentity(target, "directory");
    if (!sameObjectIdentity(build, published) || published.parentDev !== parent.dev || published.parentIno !== parent.ino) {
      throw new Error("Published snapshot directory identity changed");
    }
    return published;
  } catch (error) {
    primaryError = error;
  }
  try {
    await safeRemoveOwnedSnapshotDirectory(layout, renamedIdentity, true);
  } catch (cleanupError) {
    throw new AggregateError(
      [primaryError, new Error(`Published snapshot target was retained because exact cleanup was ambiguous: ${target}`, { cause: cleanupError })],
      "Snapshot publication failed after rename and target cleanup was ambiguous",
      { cause: primaryError }
    );
  }
  throw primaryError;
}
async function safeRemoveOwnedSnapshotDirectory(layout, identity, requirePresent = false) {
  if (identity.kind !== "directory") throw new Error("Owned snapshot identity must describe a directory");
  assertCacheChild(layout, identity.path, "directory");
  if (!isStrictlyInside(layout.indexes, identity.path) || !/^[a-f0-9]{64}$/iu.test(basename(identity.path))) {
    throw new Error("Owned snapshot identity has an invalid snapshot-directory path");
  }
  if (!await optionalLstat(identity.path)) {
    if (requirePresent) throw new Error(`Published snapshot target disappeared before exact cleanup: ${identity.path}`);
    return;
  }
  await validateSecurePathIdentity(layout, identity);
  await rm(identity.path, { recursive: true });
}
async function safeRemoveOwnedBuildDirectory(layout, identity) {
  if (identity.kind !== "directory") throw new Error("Owned build identity must describe a directory");
  assertCacheChild(layout, identity.path, "directory");
  if (!/^\.build-[a-f0-9-]{36}$/iu.test(basename(identity.path))) {
    throw new Error("Owned build identity has an invalid build-directory name");
  }
  const metadata = await optionalLstat(identity.path);
  if (!metadata) return;
  await validateSecurePathIdentity(layout, identity);
  await rm(identity.path, { recursive: true });
}

// src/security/cursor.ts
var cursorMaximumLifetimeMs = 7 * 24 * 60 * 60 * 1e3;
var cursorTokenBytes = 4096;
var cursorBodyBytes = 3072;
var hmacBytes = 32;
var encodedHmacBytes = 43;
var base64Url = /^[A-Za-z0-9_-]+$/u;
function malformedCursor() {
  return new Error("Cursor is malformed or tampered");
}
function canonicalValue(value, ancestors) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw malformedCursor();
    return value;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw malformedCursor();
    ancestors.add(value);
    const normalized3 = value.map((item) => canonicalValue(item, ancestors));
    ancestors.delete(value);
    return normalized3;
  }
  if (typeof value === "object") {
    if (ancestors.has(value)) throw malformedCursor();
    ancestors.add(value);
    const normalized3 = Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right, "en-US")).map(([key, nested]) => [key, canonicalValue(nested, ancestors)]));
    ancestors.delete(value);
    return normalized3;
  }
  throw malformedCursor();
}
function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value, /* @__PURE__ */ new Set()));
}
function decodeBase64Url(value, maximumBytes) {
  if (!value || !base64Url.test(value) || value.length % 4 === 1) throw malformedCursor();
  if (value.length > Math.ceil(maximumBytes * 4 / 3)) throw malformedCursor();
  const decoded = Buffer2.from(value, "base64url");
  if (decoded.byteLength > maximumBytes || decoded.toString("base64url") !== value) throw malformedCursor();
  return decoded;
}
function exactObject(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw malformedCursor();
  const object = value;
  const actual = Object.keys(object).sort((left, right) => left.localeCompare(right, "en-US"));
  const expected = [...fields].sort((left, right) => left.localeCompare(right, "en-US"));
  if (actual.length !== expected.length || actual.some((field, index2) => field !== expected[index2])) throw malformedCursor();
  return object;
}
function boundedBinding(value) {
  if (typeof value !== "string" || value.length < 1 || Buffer2.byteLength(value, "utf8") > 512) throw malformedCursor();
  return value;
}
function safeOffset(value) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw malformedCursor();
  return Number(value);
}
function cursorTimes(object) {
  if (!Number.isSafeInteger(object.issuedAt) || Number(object.issuedAt) < 0 || !Number.isSafeInteger(object.expiresAt) || Number(object.expiresAt) <= 0) throw malformedCursor();
  const issuedAt = Number(object.issuedAt);
  const expiresAt = Number(object.expiresAt);
  if (issuedAt >= expiresAt || expiresAt - issuedAt > cursorMaximumLifetimeMs) throw malformedCursor();
  return { issuedAt, expiresAt };
}
function parseScopeCursorPayload(value) {
  const object = exactObject(value, ["version", "snapshotId", "scopeKey", "view", "offset", "issuedAt", "expiresAt"]);
  if (object.version !== 2 || object.view !== "files" && object.view !== "evidence" && object.view !== "details") {
    throw malformedCursor();
  }
  return {
    version: 2,
    snapshotId: boundedBinding(object.snapshotId),
    scopeKey: boundedBinding(object.scopeKey),
    view: object.view,
    offset: safeOffset(object.offset),
    ...cursorTimes(object)
  };
}
function parseHistoryCursorPayload(value) {
  const object = exactObject(value, ["version", "snapshotId", "filterKey", "offset", "issuedAt", "expiresAt"]);
  if (object.version !== 2) throw malformedCursor();
  return {
    version: 2,
    snapshotId: boundedBinding(object.snapshotId),
    filterKey: boundedBinding(object.filterKey),
    offset: safeOffset(object.offset),
    ...cursorTimes(object)
  };
}
function assertCursorCurrent(cursor, now) {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Cursor validation clock is invalid");
  if (now < cursor.issuedAt) throw new Error("Cursor was issued in the future");
  if (now >= cursor.expiresAt) throw new Error("Cursor has expired");
}
function cursorExpiresAt(issuedAt) {
  if (!Number.isSafeInteger(issuedAt) || issuedAt < 0) throw new Error("Cursor issuance clock is invalid");
  const expiresAt = issuedAt + cursorMaximumLifetimeMs;
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= issuedAt) throw new Error("Cursor expiry is invalid");
  return expiresAt;
}
async function readKey(layout, path) {
  try {
    await validateCacheFile(layout, path, false);
    const key = await readFile2(path);
    if (key.byteLength !== hmacBytes) throw new Error("Persistent cursor key is invalid");
    return key;
  } catch (error) {
    if (error.code === "ENOENT" || /component is missing|no such file/i.test(String(error.message))) {
      return void 0;
    }
    throw error;
  }
}
async function loadOrCreateCursorKey(layout) {
  const path = join2(layout.root, "cursor-hmac.key");
  const existing = await readKey(layout, path);
  if (existing) return existing;
  try {
    await publishExclusiveFile(layout, path, randomBytes2(hmacBytes));
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const created = await readKey(layout, path);
  if (!created) throw new Error("Persistent cursor key could not be created");
  return created;
}
function hmacCursorCodec(key) {
  const mac = (body) => createHmac("sha256", key).update(body, "ascii").digest();
  return {
    encode(payload) {
      const json = canonicalJson(payload);
      if (Buffer2.byteLength(json, "utf8") > cursorBodyBytes) throw malformedCursor();
      const body = Buffer2.from(json, "utf8").toString("base64url");
      const token = `${body}.${mac(body).toString("base64url")}`;
      if (Buffer2.byteLength(token, "utf8") > cursorTokenBytes) throw malformedCursor();
      return token;
    },
    decode(token, parse2) {
      try {
        if (typeof token !== "string" || Buffer2.byteLength(token, "utf8") > cursorTokenBytes) throw malformedCursor();
        const parts = token.split(".");
        if (parts.length !== 2) throw malformedCursor();
        const [body, encodedMac] = parts;
        if (encodedMac.length !== encodedHmacBytes) throw malformedCursor();
        const supplied = decodeBase64Url(encodedMac, hmacBytes);
        if (supplied.byteLength !== hmacBytes) throw malformedCursor();
        const expected = mac(body);
        if (!timingSafeEqual(supplied, expected)) throw malformedCursor();
        const bodyBytes = decodeBase64Url(body, cursorBodyBytes);
        const json = bodyBytes.toString("utf8");
        const value = JSON.parse(json);
        if (canonicalJson(value) !== json) throw malformedCursor();
        return parse2(value);
      } catch {
        throw malformedCursor();
      }
    }
  };
}
async function createCursorCodec(options = {}, projectRoot) {
  const layout = await prepareSecureCache(options, projectRoot);
  return hmacCursorCodec(await loadOrCreateCursorKey(layout));
}

// src/scope/pagination.ts
import { Buffer as Buffer3 } from "node:buffer";
async function pageItems(input) {
  if (!Number.isSafeInteger(input.now) || input.now < 0 || !Number.isSafeInteger(input.expiresAt) || input.expiresAt <= input.now || input.expiresAt - input.now > cursorMaximumLifetimeMs) {
    throw new Error("Scan cursor retention expiry is invalid");
  }
  const cursor = input.cursor ? input.codec.decode(input.cursor, parseScopeCursorPayload) : void 0;
  if (cursor) assertCursorCurrent(cursor, input.now);
  if (cursor && (cursor.snapshotId !== input.snapshotId || cursor.scopeKey !== input.scopeKey || cursor.view !== input.view)) {
    throw new Error("Scan cursor does not belong to this snapshot, scope, or view");
  }
  if (cursor && cursor.expiresAt !== input.expiresAt) {
    throw new Error("Scan cursor expiry does not match the retained snapshot expiry");
  }
  const offset = cursor?.offset ?? 0;
  if (offset > input.items.length) throw new Error("Scan cursor offset exceeds the available result set");
  const items = [];
  let bytes = 2;
  const byteBudget = input.byteBudget ?? Number.POSITIVE_INFINITY;
  for (let index2 = offset; index2 < input.items.length && items.length < input.limit; index2 += 1) {
    const candidate = input.items[index2];
    const candidateBytes = Buffer3.byteLength(JSON.stringify(candidate), "utf8") + (items.length > 0 ? 1 : 0);
    if (items.length > 0 && bytes + candidateBytes > byteBudget) break;
    items.push(candidate);
    bytes += candidateBytes;
  }
  const nextOffset = offset + items.length;
  const complete = nextOffset >= input.items.length;
  return {
    items,
    page: {
      limit: input.limit,
      ...complete ? {} : { nextCursor: input.codec.encode({
        version: 2,
        snapshotId: input.snapshotId,
        scopeKey: input.scopeKey,
        view: input.view,
        offset: nextOffset,
        issuedAt: cursor?.issuedAt ?? input.now,
        expiresAt: cursor?.expiresAt ?? input.expiresAt
      }) },
      complete
    }
  };
}
function scanLimit(value) {
  if (value === void 0) return 200;
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 1e3) {
    throw new Error("Scan limit must be an integer between 1 and 1000");
  }
  return Number(value);
}
function scanView(value) {
  if (value === void 0) return "summary";
  if (value !== "summary" && value !== "files" && value !== "evidence") {
    throw new Error("Scan view must be summary, files, or evidence");
  }
  return value;
}

// src/scope/reader.ts
import { createHash as createHash2 } from "node:crypto";
import { lstat as lstat3, open as open3, realpath as realpath3 } from "node:fs/promises";
import { resolve as resolve3 } from "node:path";
var maximumLinePrefixBytes = 16 * 1024;
function samePath(left, right) {
  const normalizedLeft = resolve3(left);
  const normalizedRight = resolve3(right);
  return process.platform === "win32" ? normalizedLeft.toLocaleLowerCase("en-US") === normalizedRight.toLocaleLowerCase("en-US") : normalizedLeft === normalizedRight;
}
function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.gid === right.gid && left.mode === right.mode && left.nlink === right.nlink && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs && left.isFile() && right.isFile() && !left.isSymbolicLink() && !right.isSymbolicLink();
}
function appendBoundedPrefix(prefix, value) {
  let remaining = maximumLinePrefixBytes - Buffer.byteLength(prefix, "utf8");
  if (remaining <= 0 || value.length === 0) return prefix;
  if (Buffer.byteLength(value, "utf8") <= remaining) return prefix + value;
  let appended = prefix;
  for (const character of value) {
    const bytes = Buffer.byteLength(character, "utf8");
    if (bytes > remaining) break;
    appended += character;
    remaining -= bytes;
  }
  return appended;
}
function budgetOmission(input, reason, size) {
  return {
    evidence: [],
    omission: { path: input.outputPath, reason, ...size === void 0 ? {} : { size } }
  };
}
async function readIndexedFile(input, io = {}) {
  const lexicalPath = resolve3(input.absolutePath);
  try {
    input.deadline.check();
    await io.beforeStat?.(lexicalPath);
    input.deadline.check();
  } catch (error) {
    try {
      input.deadline.check();
    } catch {
      return budgetOmission(input, "deadline");
    }
    throw error;
  }
  let metadata;
  try {
    metadata = await lstat3(lexicalPath, { bigint: true });
  } catch {
    return budgetOmission(input, "unreadable");
  }
  const size = Number(metadata.size);
  if (!Number.isSafeInteger(size) || size < 0) return budgetOmission(input, "file-bytes");
  let canonicalPath;
  try {
    canonicalPath = await realpath3(lexicalPath);
  } catch {
    return budgetOmission(input, "unsafe", size);
  }
  if (metadata.isSymbolicLink() || !metadata.isFile() || !samePath(canonicalPath, lexicalPath)) {
    return budgetOmission(input, "unsafe", size);
  }
  if (size > input.maxFileBytes) {
    return budgetOmission(input, "file-bytes", size);
  }
  try {
    input.deadline.check();
  } catch {
    return budgetOmission(input, "deadline", size);
  }
  try {
    input.bytes.consume(size);
  } catch {
    return budgetOmission(input, "aggregate-bytes", size);
  }
  try {
    await io.beforeOpen?.(lexicalPath);
    input.deadline.check();
  } catch (error) {
    try {
      input.deadline.check();
    } catch {
      return budgetOmission(input, "deadline", size);
    }
    throw error;
  }
  let handle;
  try {
    handle = await open3(lexicalPath, "r");
  } catch {
    return budgetOmission(input, "unreadable", size);
  }
  let result;
  try {
    const opened = await handle.stat({ bigint: true });
    if (!sameIdentity(metadata, opened) || Number(opened.size) !== size) {
      return budgetOmission(input, "unsafe", size);
    }
    await io.afterOpenIdentityCheck?.(lexicalPath);
    try {
      input.deadline.check();
    } catch {
      return budgetOmission(input, "deadline", size);
    }
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    const digest = createHash2("sha256");
    const evidence = [];
    let bytesRead = 0;
    let prefix = "";
    let lineBytes = 0;
    let lastLineCharacter = "";
    let lineNumber = 1;
    let endedWithNewline = false;
    let binary = false;
    let deadlineExceeded = false;
    let evidenceExceeded = false;
    const append = (value) => {
      lineBytes += Buffer.byteLength(value, "utf8");
      prefix = appendBoundedPrefix(prefix, value);
      if (value.length > 0) lastLineCharacter = value.at(-1);
    };
    const finishLine = (stripCarriageReturn) => {
      let exactBytes = lineBytes;
      let text = prefix;
      if (stripCarriageReturn && exactBytes > 0) {
        exactBytes -= 1;
        if (text.endsWith("\r")) text = text.slice(0, -1);
      }
      try {
        input.evidence.consume();
      } catch {
        evidenceExceeded = true;
        return false;
      }
      const prefixBytes = Buffer.byteLength(text, "utf8");
      evidence.push({
        path: input.outputPath,
        line: lineNumber,
        text,
        ...prefixBytes < exactBytes ? { truncated: true, textBytes: exactBytes } : {}
      });
      lineNumber += 1;
      prefix = "";
      lineBytes = 0;
      lastLineCharacter = "";
      return true;
    };
    const decodeLines = (value) => {
      let start = 0;
      for (; ; ) {
        const newline = value.indexOf("\n", start);
        if (newline < 0) break;
        const segment = value.slice(start, newline);
        append(segment);
        if (!finishLine(lastLineCharacter === "\r")) return false;
        endedWithNewline = true;
        start = newline + 1;
      }
      const remainder = value.slice(start);
      if (remainder.length > 0) {
        append(remainder);
        endedWithNewline = false;
      }
      return true;
    };
    try {
      const stream = size === 0 ? void 0 : handle.createReadStream({
        autoClose: false,
        highWaterMark: 64 * 1024,
        start: 0,
        end: size - 1
      });
      for await (const value of stream ?? []) {
        try {
          input.deadline.check();
        } catch {
          deadlineExceeded = true;
          stream?.destroy();
          break;
        }
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        bytesRead += chunk.byteLength;
        await io.onChunkRead?.(lexicalPath, chunk.byteLength, bytesRead);
        try {
          input.deadline.check();
        } catch {
          deadlineExceeded = true;
          stream?.destroy();
          break;
        }
        if (bytesRead > size) {
          stream?.destroy();
          return budgetOmission(input, "unsafe", size);
        }
        digest.update(chunk);
        if (chunk.includes(0)) {
          binary = true;
          stream?.destroy();
          break;
        }
        let decoded;
        try {
          decoded = decoder.decode(chunk, { stream: true });
        } catch {
          binary = true;
          stream?.destroy();
          break;
        }
        if (!decodeLines(decoded)) {
          stream?.destroy();
          break;
        }
      }
      if (!binary && !deadlineExceeded && !evidenceExceeded) {
        let tail;
        try {
          tail = decoder.decode();
        } catch {
          binary = true;
          tail = "";
        }
        if (!binary && decodeLines(tail) && !endedWithNewline && bytesRead > 0) finishLine(false);
      }
    } catch {
      if (!binary && !deadlineExceeded && !evidenceExceeded) return budgetOmission(input, "unreadable", size);
    }
    if (binary) return budgetOmission(input, "binary", size);
    if (deadlineExceeded) return budgetOmission(input, "deadline", size);
    if (evidenceExceeded) return budgetOmission(input, "evidence-limit", size);
    if (bytesRead !== size) return budgetOmission(input, "unsafe", size);
    try {
      input.deadline.check();
    } catch {
      return budgetOmission(input, "deadline", size);
    }
    await io.beforeFinalIdentityCheck?.(lexicalPath);
    try {
      input.deadline.check();
    } catch {
      return budgetOmission(input, "deadline", size);
    }
    let finalPath;
    let finalCanonical;
    try {
      [finalPath, finalCanonical] = await Promise.all([
        lstat3(lexicalPath, { bigint: true }),
        realpath3(lexicalPath)
      ]);
    } catch {
      return budgetOmission(input, "unsafe", size);
    }
    const finalHandle = await handle.stat({ bigint: true });
    if (!sameIdentity(metadata, finalPath) || !sameIdentity(metadata, finalHandle) || Number(finalPath.size) !== size || Number(finalHandle.size) !== size || !samePath(finalCanonical, lexicalPath)) {
      return budgetOmission(input, "unsafe", size);
    }
    try {
      input.deadline.check();
    } catch {
      return budgetOmission(input, "deadline", size);
    }
    result = {
      file: {
        path: input.outputPath,
        fingerprint: `sha256:${digest.digest("hex")}`,
        size,
        lineCount: evidence.length
      },
      evidence
    };
  } finally {
    await handle.close();
  }
  return result;
}

// src/scope/store.ts
import { createHash as createHash3, createHmac as createHmac2, randomBytes as randomBytes3, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
import { lstat as lstat4, open as open4, opendir as opendir3 } from "node:fs/promises";
import { dirname as dirname3, join as join3, resolve as resolve4 } from "node:path";
import { performance as performance3 } from "node:perf_hooks";
function hashKey(value) {
  return createHash3("sha256").update(value).digest("hex");
}
function scopeProjectKey(projectRoot) {
  return hashKey(resolve4(projectRoot));
}
function scopePathsKey(scopePaths) {
  return hashKey(JSON.stringify(scopePaths));
}
function scopeCursorKey(projectRoot, scopeKey) {
  return scopeCursorKeyFromProjectKey(scopeProjectKey(projectRoot), scopeKey);
}
function scopeCursorKeyFromProjectKey(projectKey, scopeKey) {
  return hashKey(JSON.stringify({ projectKey, scopeKey }));
}
function jsonLines(values) {
  return values.map((value) => JSON.stringify(value)).join("\n") + (values.length > 0 ? "\n" : "");
}
function structuredSnapshotId(sections) {
  const digest = createHash3("sha256");
  for (const [name2, values] of sections) {
    digest.update(`${name2}\0${values.length}\0`, "utf8");
    for (const value of values) {
      const serialized = JSON.stringify(canonicalSnapshotValue(value));
      digest.update(`${Buffer.byteLength(serialized, "utf8")}\0`, "ascii");
      digest.update(serialized, "utf8");
    }
  }
  return `sha256:${digest.digest("hex")}`;
}
function canonicalSnapshotValue(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalSnapshotValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, nested]) => nested !== void 0).sort(([left], [right]) => left.localeCompare(right, "en-US")).map(([key, nested]) => [key, canonicalSnapshotValue(nested)]));
  }
  return value;
}
function scopeSnapshotIdForContent(input) {
  const sourceSnapshotId = structuredSnapshotId([
    ["scope-paths", input.scopePaths],
    ["files", input.files],
    ["evidence", input.evidence],
    ["candidate-modules", input.candidateModules ?? []],
    ["omissions", input.omissions ?? []]
  ]);
  if (input.details === void 0 && input.driftSummary === void 0) return sourceSnapshotId;
  if (input.details === void 0 || input.driftSummary === void 0) {
    throw new Error("Drift snapshot content requires both details and summary");
  }
  return structuredSnapshotId([
    ["source-snapshot", [sourceSnapshotId]],
    ["drift-summary", [input.driftSummary]],
    ["drift-details", input.details]
  ]);
}
function candidateModuleRoot(path) {
  const normalized3 = path.replaceAll("\\", "/");
  const parts = normalized3.split("/");
  if (parts.length === 1) return { id: "root", path: "." };
  const first = parts[0];
  const nestedRoots = /* @__PURE__ */ new Set(["apps", "features", "lib", "modules", "packages", "plugins", "source", "src"]);
  const rootParts = nestedRoots.has(first.toLocaleLowerCase("en-US")) && parts.length > 2 ? [first, parts[1]] : [first];
  const root = rootParts.join("/");
  const idParts = rootParts.map((part) => part.normalize("NFKD").toLocaleLowerCase("en-US").replace(/[^a-z0-9_-]+/gu, "-").replace(/^-+|-+$/gu, "")).filter(Boolean);
  const fallback = createHash3("sha256").update(root).digest("hex").slice(0, 8);
  return { id: idParts.length > 0 ? idParts.join(".") : `module.${fallback}`, path: root };
}
function scopeCandidateModulesForFiles(files) {
  const modules = /* @__PURE__ */ new Map();
  for (const file of files) {
    const candidate = candidateModuleRoot(file.path);
    const existing = modules.get(candidate.id);
    if (existing) {
      existing.fileCount += 1;
      existing.evidenceCount += file.lineCount;
      if (!existing.paths.includes(candidate.path)) existing.paths.push(candidate.path);
    } else {
      modules.set(candidate.id, {
        id: candidate.id,
        paths: [candidate.path],
        fileCount: 1,
        evidenceCount: file.lineCount
      });
    }
  }
  return [...modules.values()].map((module) => ({ ...module, paths: [...module.paths].sort((left, right) => left.localeCompare(right, "en-US")) })).sort((left, right) => left.id.localeCompare(right.id, "en-US") || left.paths[0].localeCompare(right.paths[0], "en-US"));
}
var nodeScopeStoreIo = {};
var ScopeSnapshotRestartError = class extends Error {
  constructor(reason, options) {
    super(`Scope snapshot is ${reason}; restart pagination from the first page`, options);
    this.reason = reason;
    this.name = "ScopeSnapshotRestartError";
  }
  restartPagination = true;
};
function missingPath(error) {
  return error.code === "ENOENT" || /component is missing|no such file/i.test(String(error.message));
}
function exactKeys(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en-US"));
  const expected = [...fields].sort((left, right) => left.localeCompare(right, "en-US"));
  return actual.length === expected.length && actual.every((field, index2) => field === expected[index2]);
}
async function readBoundedCacheFile(layout, path, maximumBytes, hooks = {}) {
  await validateCacheFile(layout, path, false);
  const identity = await captureSecurePathIdentity(layout, path, "file");
  await hooks.afterShardIdentity?.(identity);
  const initialPath = await lstat4(path, { bigint: true });
  assertSecureOwnerFileMetadata(initialPath, path, 1n);
  if (initialPath.dev !== BigInt(identity.dev) || initialPath.ino !== BigInt(identity.ino)) {
    throw new Error("Scope cache file path identity changed before bounded read");
  }
  const handle = await open4(path, "r");
  try {
    const opened = await handle.stat({ bigint: true });
    if (!samePublicationArtifactVersion(initialPath, opened)) {
      throw new Error("Scope cache file handle identity or metadata does not match the captured path");
    }
    if (opened.size > BigInt(maximumBytes)) throw new Error("Scope cache file exceeds its byte budget");
    const size = Number(opened.size);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error("Scope cache file length is invalid");
    await hooks.afterBoundedFileStat?.(path, size);
    const bytes = Buffer.allocUnsafe(size);
    let offset = 0;
    while (offset < size) {
      const read = await handle.read(bytes, offset, Math.min(64 * 1024, size - offset), offset);
      if (read.bytesRead < 1) throw new Error("Scope cache file was truncated during bounded read");
      offset += read.bytesRead;
      await hooks.onBoundedFileRead?.(path, read.bytesRead);
    }
    await hooks.beforeShardFinalIdentity?.(identity);
    await validateSecurePathIdentity(layout, identity);
    const [finalPath, finalHandle] = await Promise.all([
      lstat4(path, { bigint: true }),
      handle.stat({ bigint: true })
    ]);
    if (!samePublicationArtifactVersion(opened, finalPath) || !samePublicationArtifactVersion(opened, finalHandle)) {
      throw new Error("Scope cache file identity or metadata changed during bounded read");
    }
    return { bytes, identity };
  } finally {
    await handle.close();
  }
}
async function exactSnapshotEntries(target, metadata) {
  const expected = ["evidence.jsonl", "files.jsonl", "metadata.json", ...metadata.shards.details ? ["details.jsonl"] : []].sort((left, right) => left.localeCompare(right, "en-US"));
  const actual = [];
  const budget = new CounterBudget("Scope snapshot directory entries", expected.length + 1);
  const directory = await opendir3(target);
  try {
    for await (const entry of directory) {
      budget.consume();
      if (!entry.isFile()) throw new Error("Scope snapshot contains a non-file entry");
      actual.push(entry.name);
    }
  } finally {
    await directory.close().catch(() => void 0);
  }
  actual.sort((left, right) => left.localeCompare(right, "en-US"));
  if (actual.length !== expected.length || actual.some((entry, index2) => entry !== expected[index2])) {
    throw new Error("Scope snapshot does not contain the exact shard set");
  }
}
async function readJsonLinesShard(layout, path, expected, parse2, hooks = {}) {
  if (expected.bytes > keeperLimits.scan.maxAggregateBytes || expected.count > keeperLimits.scan.maxEvidence) {
    throw new Error("Scope shard metadata exceeds the hard limits");
  }
  await validateCacheFile(layout, path, false);
  const identity = await captureSecurePathIdentity(layout, path, "file");
  await hooks.afterShardIdentity?.(identity);
  const handle = await open4(path, "r");
  try {
    const opened = await handle.stat({ bigint: true });
    if (opened.dev !== BigInt(identity.dev) || opened.ino !== BigInt(identity.ino)) {
      throw new Error("Scope shard handle identity does not match the captured path");
    }
    assertSecureOwnerFileMetadata(opened, path, 1n);
    if (opened.size !== BigInt(expected.bytes)) throw new Error("Scope shard length does not match metadata");
    const digest = createHash3("sha256");
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const values = [];
    let consumed = 0;
    let pending = "";
    let pendingBytes = 0;
    const finish = (line) => {
      if (line.length === 0) throw new Error("Scope shard contains an empty JSON line");
      const parsed = JSON.parse(line);
      if (JSON.stringify(parsed) !== line) throw new Error("Scope shard JSON line is not canonical");
      values.push(parse2(parsed));
      if (values.length > expected.count) throw new Error("Scope shard count exceeds metadata");
    };
    for await (const value of handle.createReadStream({ autoClose: false, highWaterMark: 64 * 1024 })) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      consumed += chunk.byteLength;
      if (consumed > expected.bytes) throw new Error("Scope shard length exceeds metadata");
      await hooks.onBoundedFileRead?.(path, chunk.byteLength);
      digest.update(chunk);
      const decoded = decoder.decode(chunk, { stream: true });
      let start = 0;
      for (; ; ) {
        const newline = decoded.indexOf("\n", start);
        if (newline < 0) break;
        const part = decoded.slice(start, newline);
        pending += part;
        pendingBytes += Buffer.byteLength(part, "utf8");
        if (pendingBytes > maximumJsonLineBytes) throw new Error("Scope shard JSON line exceeds its byte budget");
        finish(pending);
        pending = "";
        pendingBytes = 0;
        start = newline + 1;
      }
      const remainder = decoded.slice(start);
      pending += remainder;
      pendingBytes += Buffer.byteLength(remainder, "utf8");
      if (pendingBytes > maximumJsonLineBytes) throw new Error("Scope shard JSON line exceeds its byte budget");
    }
    const tail = decoder.decode();
    if (tail.length > 0) {
      pending += tail;
      pendingBytes += Buffer.byteLength(tail, "utf8");
    }
    if (pending.length > 0 || expected.bytes > 0 && values.length === 0) {
      throw new Error("Scope shard must end with a newline");
    }
    if (consumed !== expected.bytes || values.length !== expected.count || `sha256:${digest.digest("hex")}` !== expected.hash) {
      throw new Error("Scope shard hash, length, or count does not match metadata");
    }
    const finalHandle = await handle.stat({ bigint: true });
    if (finalHandle.dev !== opened.dev || finalHandle.ino !== opened.ino || finalHandle.size !== opened.size) {
      throw new Error("Scope shard handle identity changed during read");
    }
    assertSecureOwnerFileMetadata(finalHandle, path, 1n);
    await hooks.beforeShardFinalIdentity?.(identity);
    await validateSecurePathIdentity(layout, identity);
    return { values, identity };
  } finally {
    await handle.close();
  }
}
function parseDetail(value) {
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > maximumJsonLineBytes) throw new Error("Scope detail exceeds its byte budget");
  return scopeDriftDetailSchema.parse(value);
}
function validateScopeShardRelationships(files, evidence) {
  const byPath = /* @__PURE__ */ new Map();
  for (let index2 = 0; index2 < files.length; index2 += 1) {
    const file = files[index2];
    const key = windowsRepositoryPathKey(file.path);
    if (byPath.has(key)) throw new Error("Scope file shard paths contain a Windows-equivalent alias");
    if (index2 > 0 && windowsRepositoryPathKey(files[index2 - 1].path).localeCompare(key, "en-US") >= 0) {
      throw new Error("Scope file shard paths must be unique and strictly ordered");
    }
    byPath.set(key, file);
  }
  const evidenceCounts = /* @__PURE__ */ new Map();
  for (let index2 = 0; index2 < evidence.length; index2 += 1) {
    const item = evidence[index2];
    const key = windowsRepositoryPathKey(item.path);
    const file = byPath.get(key);
    if (!file || item.line > file.lineCount) throw new Error("Scope evidence does not bind to its file line count");
    if (file.path !== item.path) throw new Error("Scope evidence path casing does not exactly bind to its file");
    if (index2 > 0) {
      const previous = evidence[index2 - 1];
      if (windowsRepositoryPathKey(previous.path).localeCompare(key, "en-US") > 0 || previous.path === item.path && previous.line >= item.line) {
        throw new Error("Scope evidence paths and lines must be unique and strictly ordered");
      }
    }
    evidenceCounts.set(key, (evidenceCounts.get(key) ?? 0) + 1);
  }
  for (const file of files) {
    if ((evidenceCounts.get(windowsRepositoryPathKey(file.path)) ?? 0) !== file.lineCount) {
      throw new Error("Scope file line count does not match its evidence records");
    }
  }
}
function validateCandidateModules(metadata, files) {
  if (JSON.stringify(metadata.candidateModules) !== JSON.stringify(scopeCandidateModulesForFiles(files))) {
    throw new Error("Scope candidate module counts do not match loaded file evidence");
  }
}
function validateDriftShardRelationships(metadata, details) {
  if (!metadata.driftSummary && details === void 0) return;
  if (!metadata.driftSummary || details === void 0) throw new Error("Scope drift summary and detail shard must be paired");
  const counts = { new: 0, modified: 0, deleted: 0 };
  const invalidated = /* @__PURE__ */ new Set();
  for (const detail of details) {
    if (detail.kind === "new" || detail.kind === "modified" || detail.kind === "deleted") counts[detail.kind] += 1;
    if (typeof detail.recordId === "string") invalidated.add(detail.recordId);
  }
  if (counts.new !== metadata.driftSummary.counts.new || counts.modified !== metadata.driftSummary.counts.modified || counts.deleted !== metadata.driftSummary.counts.deleted) {
    throw new Error("Scope drift summary counts do not match exact details");
  }
  const declared = [...metadata.driftSummary.invalidatedRecordIds].sort((left, right) => left.localeCompare(right, "en-US"));
  const actual = [...invalidated].sort((left, right) => left.localeCompare(right, "en-US"));
  if (JSON.stringify(declared) !== JSON.stringify(actual)) {
    throw new Error("Scope drift invalidated record IDs do not match exact details");
  }
}
async function validateSnapshotDirectory(layout, target, bindings, hooks = {}) {
  const identity = await captureSecurePathIdentity(layout, target, "directory");
  const metadataPath = join3(target, "metadata.json");
  await hooks.beforeReadShard?.(metadataPath);
  const metadataFile = await readBoundedCacheFile(layout, metadataPath, maximumMetadataBytes, hooks);
  let metadataValue;
  try {
    metadataValue = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(metadataFile.bytes));
  } catch {
    throw new Error("Scope snapshot metadata is not valid JSON");
  }
  const metadata = scopeIndexMetadataV3Schema.parse(metadataValue);
  const declaredSnapshotBytes = metadataFile.bytes.byteLength + metadata.shards.files.bytes + metadata.shards.evidence.bytes + (metadata.shards.details?.bytes ?? 0);
  if (!Number.isSafeInteger(declaredSnapshotBytes) || declaredSnapshotBytes > keeperLimits.scan.maxAggregateBytes || declaredSnapshotBytes > scopeProjectByteLimit) {
    throw new Error("Scope snapshot aggregate shard metadata exceeds the hard byte limit");
  }
  const derivedScopeKey = scopePathsKey(metadata.scopePaths);
  const derivedCursorScopeKey = scopeCursorKeyFromProjectKey(metadata.projectKey, derivedScopeKey);
  if (metadata.scopeKey !== derivedScopeKey || metadata.cursorScopeKey !== derivedCursorScopeKey) {
    throw new Error("Scope snapshot metadata scope binding is invalid");
  }
  if (metadata.projectKey !== bindings.projectKey || metadata.cursorScopeKey !== bindings.cursorScopeKey || metadata.snapshotId !== bindings.snapshotId || bindings.scopeKey !== void 0 && metadata.scopeKey !== bindings.scopeKey || bindings.scopePaths !== void 0 && JSON.stringify(metadata.scopePaths) !== JSON.stringify(bindings.scopePaths)) {
    throw new Error("Scope snapshot metadata binding is invalid");
  }
  await validateSecurePathIdentity(layout, identity);
  await exactSnapshotEntries(target, metadata);
  const filesPath = join3(target, metadata.shards.files.path);
  const evidencePath = join3(target, metadata.shards.evidence.path);
  await hooks.beforeReadShard?.(filesPath);
  const filesShard = await readJsonLinesShard(layout, filesPath, metadata.shards.files, (value) => scopeFileEntrySchema.parse(value), hooks);
  const files = filesShard.values;
  await hooks.beforeReadShard?.(evidencePath);
  const evidenceShard = await readJsonLinesShard(layout, evidencePath, metadata.shards.evidence, (value) => scopeEvidenceSchema.parse(value), hooks);
  const evidence = evidenceShard.values;
  let details;
  let detailsIdentity;
  if (metadata.shards.details) {
    const detailsPath = join3(target, metadata.shards.details.path);
    await hooks.beforeReadShard?.(detailsPath);
    const detailsShard = await readJsonLinesShard(layout, detailsPath, metadata.shards.details, parseDetail, hooks);
    details = detailsShard.values;
    detailsIdentity = detailsShard.identity;
  }
  validateScopeShardRelationships(files, evidence);
  validateCandidateModules(metadata, files);
  validateDriftShardRelationships(metadata, details);
  const derivedSnapshotId = scopeSnapshotIdForContent({
    scopePaths: metadata.scopePaths,
    files,
    evidence,
    candidateModules: metadata.candidateModules,
    omissions: metadata.omissions,
    ...details === void 0 ? {} : { details },
    ...metadata.driftSummary === void 0 ? {} : { driftSummary: metadata.driftSummary }
  });
  if (metadata.snapshotId !== derivedSnapshotId) throw new Error("Scope snapshot content binding is invalid");
  await hooks.afterSnapshotReads?.(target);
  await validateSecurePathIdentity(layout, identity);
  await exactSnapshotEntries(target, metadata);
  await Promise.all([
    validateSecurePathIdentity(layout, metadataFile.identity),
    validateSecurePathIdentity(layout, filesShard.identity),
    validateSecurePathIdentity(layout, evidenceShard.identity),
    ...detailsIdentity ? [validateSecurePathIdentity(layout, detailsIdentity)] : []
  ]);
  return { identity, metadata, metadataBytes: metadataFile.bytes.byteLength, files, evidence, ...details ? { details } : {} };
}
var scopeSnapshotLifetimeMs = 7 * 24 * 60 * 60 * 1e3;
var scopeProjectByteLimit = 256 * 1024 * 1024;
var scopeGlobalByteLimit = 1024 * 1024 * 1024;
var maximumMetadataBytes = 8 * 1024 * 1024;
var maximumJsonLineBytes = 8 * 1024 * 1024 + 1024;
function shardMetadata(path, contents, count) {
  return {
    path,
    bytes: Buffer.byteLength(contents, "utf8"),
    hash: `sha256:${createHash3("sha256").update(contents, "utf8").digest("hex")}`,
    count
  };
}
function logicalNow(input) {
  const now = input.options.now?.() ?? Date.now();
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(now + scopeSnapshotLifetimeMs)) {
    throw new Error("Scope snapshot clock is invalid");
  }
  return now;
}
function serializeScopeIndex(input) {
  const createdAt = logicalNow(input);
  const projectKey = scopeProjectKey(input.projectRoot);
  const scopeKey = scopePathsKey(input.scopePaths);
  const cursorScopeKey = scopeCursorKey(input.projectRoot, scopeKey);
  const normalizedFiles = input.files.map((value) => scopeFileEntrySchema.parse(value));
  const normalizedEvidence = input.evidence.map((value) => scopeEvidenceSchema.parse(value));
  const normalizedModules = (input.candidateModules ?? []).map((value) => candidateModuleSchema.parse(value));
  const normalizedOmissions = (input.omissions ?? []).map((value) => scopeOmissionSchema.parse(value));
  const normalizedDetails = input.details?.map((value) => parseDetail(value));
  const files = jsonLines(normalizedFiles);
  const evidence = jsonLines(normalizedEvidence);
  const details = normalizedDetails === void 0 ? void 0 : jsonLines(normalizedDetails);
  const parsedMetadata = {
    version: 3,
    createdAt,
    expiresAt: createdAt + scopeSnapshotLifetimeMs,
    projectKey,
    scopeKey,
    cursorScopeKey,
    scopePaths: input.scopePaths,
    snapshotId: input.snapshotId,
    shards: {
      files: shardMetadata("files.jsonl", files, normalizedFiles.length),
      evidence: shardMetadata("evidence.jsonl", evidence, normalizedEvidence.length),
      ...details === void 0 ? {} : { details: shardMetadata("details.jsonl", details, normalizedDetails.length) }
    },
    totals: {
      files: normalizedFiles.length,
      evidence: normalizedEvidence.length,
      omitted: normalizedOmissions.length,
      ...details === void 0 ? {} : { details: normalizedDetails.length }
    },
    candidateModules: normalizedModules,
    omissions: normalizedOmissions,
    ...input.driftSummary === void 0 ? {} : { driftSummary: input.driftSummary }
  };
  const parsed = scopeIndexMetadataV3Schema.parse(parsedMetadata);
  validateScopeShardRelationships(normalizedFiles, normalizedEvidence);
  validateCandidateModules(parsed, normalizedFiles);
  validateDriftShardRelationships(parsed, normalizedDetails);
  const derivedSnapshotId = scopeSnapshotIdForContent({
    scopePaths: parsed.scopePaths,
    files: normalizedFiles,
    evidence: normalizedEvidence,
    candidateModules: normalizedModules,
    omissions: normalizedOmissions,
    ...normalizedDetails === void 0 ? {} : { details: normalizedDetails },
    ...parsed.driftSummary === void 0 ? {} : { driftSummary: parsed.driftSummary }
  });
  if (input.snapshotId !== derivedSnapshotId) throw new Error("Scope snapshot ID does not bind its exact content");
  const metadata = `${JSON.stringify(parsed, null, 2)}
`;
  if (Buffer.byteLength(metadata, "utf8") > maximumMetadataBytes || parsed.shards.files.bytes > keeperLimits.scan.maxAggregateBytes || parsed.shards.evidence.bytes > keeperLimits.scan.maxAggregateBytes || (parsed.shards.details?.bytes ?? 0) > keeperLimits.scan.maxAggregateBytes) {
    throw new Error("Scope snapshot serialization exceeds its byte budget");
  }
  const snapshotBytes = Buffer.byteLength(metadata, "utf8") + parsed.shards.files.bytes + parsed.shards.evidence.bytes + (parsed.shards.details?.bytes ?? 0);
  if (snapshotBytes > scopeProjectByteLimit || snapshotBytes > scopeGlobalByteLimit) {
    throw new Error("Scope snapshot cannot fit within the project and global cache quotas");
  }
  return { metadata, files, evidence, ...details === void 0 ? {} : { details }, parsedMetadata: parsed };
}
async function inspectExistingSnapshot(target, expected, hooks, layout) {
  try {
    const validated = await validateSnapshotDirectory(layout, target, {
      projectKey: expected.parsedMetadata.projectKey,
      scopeKey: expected.parsedMetadata.scopeKey,
      cursorScopeKey: expected.parsedMetadata.cursorScopeKey,
      scopePaths: expected.parsedMetadata.scopePaths,
      snapshotId: expected.parsedMetadata.snapshotId
    }, hooks);
    const comparableActual = {
      ...validated.metadata,
      createdAt: 0,
      expiresAt: scopeSnapshotLifetimeMs
    };
    const comparableExpected = {
      ...expected.parsedMetadata,
      createdAt: 0,
      expiresAt: scopeSnapshotLifetimeMs
    };
    return JSON.stringify(comparableActual) === JSON.stringify(comparableExpected) ? "matching" : "invalid";
  } catch (error) {
    return missingPath(error) ? "missing" : "invalid";
  }
}
async function reconcileSnapshotPublication(target, expected, hooks, layout, deadline, nowMs, epoch) {
  let attempt = 0;
  for (; ; ) {
    if (nowMs() >= deadline) return "deadline";
    const observation = await observeOwnedSnapshotPublicationClaim(layout, target);
    if (observation.state === "absent") {
      epoch.claim = void 0;
      const winner = await inspectExistingSnapshot(target, expected, hooks, layout);
      await hooks.afterTargetInspection?.(target, winner);
      const afterInspection = await observeOwnedSnapshotPublicationClaim(layout, target);
      if (afterInspection.state !== "absent") {
        epoch.claim = afterInspection.claim;
        await hooks.afterTargetClaimRecheck?.(afterInspection.claim);
        continue;
      }
      if (winner === "matching") return "matching";
      if (winner === "invalid") throw new Error("Concurrent scope snapshot target is invalid");
      return nowMs() >= deadline ? "deadline" : "retry";
    }
    if (epoch.claim && !samePublicationClaimEpoch(epoch.claim, observation.claim)) {
      throw new Error("Concurrent scope snapshot publication claim identity or owner metadata changed");
    }
    epoch.claim = observation.claim;
    const liveness = publicationClaimLiveness(observation.claim);
    if (liveness === "dead") {
      await safeRemoveOwnedPublicationClaim(layout, observation.claim);
      epoch.claim = void 0;
      await hooks.afterStaleClaimRelease?.();
      continue;
    }
    if (liveness === "ambiguous") {
      throw new Error("Concurrent scope snapshot publication claim owner liveness is ambiguous");
    }
    attempt += 1;
    const remaining = deadline - nowMs();
    if (remaining <= 0) return "deadline";
    const operation = async () => {
      await new Promise((accept) => setTimeout(accept, Math.min(25, remaining)));
    };
    const waitResult = hooks.waitForTargetClaim ? await hooks.waitForTargetClaim(observation.claim, attempt, operation) : await operation().then(() => "continue");
    if (waitResult === "deadline" || nowMs() >= deadline) return "deadline";
  }
}
async function finalReconcileSnapshotPublication(target, expected, hooks, layout, mayReclaimDead, epoch) {
  let canReclaimDead = mayReclaimDead;
  const handleOwned = async (claim) => {
    if (epoch.claim && !samePublicationClaimEpoch(epoch.claim, claim)) {
      throw new Error("Concurrent scope snapshot publication claim identity or owner metadata changed at the acquisition deadline");
    }
    epoch.claim = claim;
    const liveness = publicationClaimLiveness(claim);
    if (liveness === "ambiguous") {
      throw new Error("Concurrent scope snapshot publication claim owner liveness is ambiguous at the acquisition deadline");
    }
    if (liveness === "alive") {
      throw new Error("Concurrent scope snapshot publication is still owned by a live process at the acquisition deadline");
    }
    if (!canReclaimDead) throw new Error("Scope snapshot acquisition deadline expired during stale-claim churn");
    await safeRemoveOwnedPublicationClaim(layout, claim);
    epoch.claim = void 0;
    canReclaimDead = false;
    await hooks.afterStaleClaimRelease?.();
  };
  let useHooks = true;
  for (; ; ) {
    const observation = await observeOwnedSnapshotPublicationClaim(layout, target);
    if (observation.state === "owned") {
      await handleOwned(observation.claim);
      continue;
    }
    epoch.claim = void 0;
    const inspectionHooks = useHooks ? hooks : {};
    const winner = await inspectExistingSnapshot(target, expected, inspectionHooks, layout);
    if (useHooks) await hooks.afterTargetInspection?.(target, winner);
    useHooks = false;
    const afterInspection = await observeOwnedSnapshotPublicationClaim(layout, target);
    if (afterInspection.state === "owned") {
      await handleOwned(afterInspection.claim);
      continue;
    }
    epoch.claim = void 0;
    const freshWinner = await inspectExistingSnapshot(target, expected, {}, layout);
    if (freshWinner === "matching") return "matching";
    if (freshWinner === "invalid") throw new Error("Concurrent scope snapshot target is invalid at the acquisition deadline");
    throw new Error("Scope snapshot acquisition deadline expired before a publisher or matching target won");
  }
}
async function writeBuildShard(layout, path, contents, hooks) {
  const operation = async () => {
    await publishExclusiveFile(layout, path, contents);
  };
  if (hooks.writeShard) await hooks.writeShard(path, contents, operation);
  else await operation();
  await validateCacheFile(layout, path, false);
}
var scopeAccessKeyBytes = 32;
var maximumAccessRecordBytes = 4096;
function accessBodyJson(body) {
  return JSON.stringify({
    version: body.version,
    projectKey: body.projectKey,
    cursorScopeKey: body.cursorScopeKey,
    snapshotId: body.snapshotId,
    createdAt: body.createdAt,
    expiresAt: body.expiresAt,
    accessedAt: body.accessedAt
  });
}
function accessMac(key, body) {
  return createHmac2("sha256", key).update(accessBodyJson(body), "utf8").digest("hex");
}
async function loadOrCreateAccessKey(layout) {
  const path = join3(layout.root, "scope-index-hmac.key");
  const read = async () => {
    try {
      const result = await readBoundedCacheFile(layout, path, scopeAccessKeyBytes);
      if (result.bytes.byteLength !== scopeAccessKeyBytes) throw new Error("Scope access registry key is invalid");
      return result.bytes;
    } catch (error) {
      if (missingPath(error)) return void 0;
      throw error;
    }
  };
  const existing = await read();
  if (existing) return existing;
  try {
    await publishExclusiveFile(layout, path, randomBytes3(scopeAccessKeyBytes));
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const created = await read();
  if (!created) throw new Error("Scope access registry key could not be created");
  return created;
}
function accessPath(layout, metadata) {
  return join3(
    layout.indexes,
    "v3",
    "access",
    metadata.projectKey,
    metadata.cursorScopeKey,
    `${metadata.snapshotId.slice("sha256:".length)}.json`
  );
}
function pendingAccessPath(layout, metadata) {
  return `${accessPath(layout, metadata)}.pending`;
}
function accessRecordBytes(record) {
  return `${JSON.stringify(record)}
`;
}
function accessRecordPhysicalBytes(metadata, accessedAt) {
  return Buffer.byteLength(accessRecordBytes({
    version: 1,
    projectKey: metadata.projectKey,
    cursorScopeKey: metadata.cursorScopeKey,
    snapshotId: metadata.snapshotId,
    createdAt: metadata.createdAt,
    expiresAt: metadata.expiresAt,
    accessedAt,
    hmac: "0".repeat(64)
  }), "utf8");
}
async function readAccessFile(layout, path, metadata, key, hooks = nodeScopeStoreIo) {
  let file;
  try {
    file = await readBoundedCacheFile(layout, path, maximumAccessRecordBytes, hooks);
  } catch (error) {
    if (missingPath(error)) return void 0;
    throw error;
  }
  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(file.bytes));
  } catch {
    throw new Error("Scope access registry record is not valid JSON");
  }
  if (!exactKeys(value, [
    "version",
    "projectKey",
    "cursorScopeKey",
    "snapshotId",
    "createdAt",
    "expiresAt",
    "accessedAt",
    "hmac"
  ])) {
    throw new Error("Scope access registry record schema is invalid");
  }
  const object = value;
  if (object.version !== 1 || typeof object.projectKey !== "string" || !/^[a-f0-9]{64}$/u.test(object.projectKey) || typeof object.cursorScopeKey !== "string" || !/^[a-f0-9]{64}$/u.test(object.cursorScopeKey) || typeof object.snapshotId !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(object.snapshotId) || !Number.isSafeInteger(object.createdAt) || !Number.isSafeInteger(object.expiresAt) || Number(object.createdAt) < 0 || Number(object.expiresAt) - Number(object.createdAt) !== scopeSnapshotLifetimeMs || !Number.isSafeInteger(object.accessedAt) || Number(object.accessedAt) < 0 || typeof object.hmac !== "string" || !/^[a-f0-9]{64}$/u.test(object.hmac)) {
    throw new Error("Scope access registry record binding is invalid");
  }
  if (metadata && (object.projectKey !== metadata.projectKey || object.cursorScopeKey !== metadata.cursorScopeKey || object.snapshotId !== metadata.snapshotId || object.createdAt !== metadata.createdAt || object.expiresAt !== metadata.expiresAt)) {
    throw new Error("Scope access registry record binding is invalid");
  }
  const body = {
    version: 1,
    projectKey: object.projectKey,
    cursorScopeKey: object.cursorScopeKey,
    snapshotId: object.snapshotId,
    createdAt: Number(object.createdAt),
    expiresAt: Number(object.expiresAt),
    accessedAt: Number(object.accessedAt)
  };
  const expected = Buffer.from(accessMac(key, body), "hex");
  const supplied = Buffer.from(object.hmac, "hex");
  if (supplied.byteLength !== expected.byteLength || !timingSafeEqual2(supplied, expected)) {
    throw new Error("Scope access registry record authentication failed");
  }
  return { record: { ...body, hmac: object.hmac }, identity: file.identity, physicalBytes: file.bytes.byteLength };
}
function samePhysicalFile(left, right) {
  return BigInt(left.dev) === BigInt(right.dev) && BigInt(left.ino) === BigInt(right.ino);
}
async function readAccessRecord(layout, metadata, key, required, hooks = nodeScopeStoreIo) {
  const [primary, pending] = await Promise.all([
    readAccessFile(layout, accessPath(layout, metadata), metadata, key, hooks),
    readAccessFile(layout, pendingAccessPath(layout, metadata), metadata, key, hooks)
  ]);
  if (!primary && !pending) {
    if (required) throw Object.assign(new Error("Scope access registry record is missing"), { code: "ENOENT" });
    return { physicalBytes: 0 };
  }
  if (primary && pending && samePhysicalFile(primary.identity, pending.identity)) {
    throw new Error("Scope access registry primary and pending records alias one physical file");
  }
  const selected2 = !primary ? pending : !pending ? primary : pending.record.accessedAt > primary.record.accessedAt ? pending : primary;
  return {
    record: selected2.record,
    identity: selected2.identity,
    physicalBytes: (primary?.physicalBytes ?? 0) + (pending?.physicalBytes ?? 0),
    ...primary ? { primaryIdentity: primary.identity } : {},
    ...pending ? { pendingIdentity: pending.identity } : {}
  };
}
async function writeAccessRecord(layout, metadata, accessedAt, requireExisting, hooks = {}, heldPruneClaim) {
  if (heldPruneClaim) {
    await validatePublicationClaim(layout, heldPruneClaim);
    await writeAccessRecordUnderPruneLock(
      layout,
      metadata,
      accessedAt,
      requireExisting,
      hooks,
      heldPruneClaim,
      false
    );
    await validatePublicationClaim(layout, heldPruneClaim);
    return;
  }
  const ownedPruneClaim = await acquireSnapshotUseClaim(layout, scopePruneLockTarget(layout), hooks);
  let failure;
  try {
    await validatePublicationClaim(layout, ownedPruneClaim);
    await writeAccessRecordUnderPruneLock(
      layout,
      metadata,
      accessedAt,
      requireExisting,
      hooks,
      ownedPruneClaim,
      true
    );
    await validatePublicationClaim(layout, ownedPruneClaim);
  } catch (error) {
    failure = error;
  }
  try {
    await safeRemoveOwnedPublicationClaim(layout, ownedPruneClaim);
  } catch (cleanupError) {
    if (failure !== void 0) {
      throw new AggregateError(
        [failure, cleanupError],
        "Scope access update and prune-claim cleanup both failed",
        { cause: failure }
      );
    }
    throw cleanupError;
  }
  if (failure !== void 0) throw failure;
}
async function writeAccessRecordUnderPruneLock(layout, metadata, accessedAt, requireExisting, hooks, pruneClaim, reserveUpdatePeak) {
  if (!Number.isSafeInteger(accessedAt) || accessedAt < 0) throw new Error("Scope access time is invalid");
  const key = await loadOrCreateAccessKey(layout);
  const path = accessPath(layout, metadata);
  const pendingPath = pendingAccessPath(layout, metadata);
  await createSecureCacheDirectory(layout, dirname3(path));
  const accessRecord = (time) => {
    const body = {
      version: 1,
      projectKey: metadata.projectKey,
      cursorScopeKey: metadata.cursorScopeKey,
      snapshotId: metadata.snapshotId,
      createdAt: metadata.createdAt,
      expiresAt: metadata.expiresAt,
      accessedAt: time
    };
    return { ...body, hmac: accessMac(key, body) };
  };
  const reserveAccessPublication = async (record2) => {
    if (!reserveUpdatePeak) return;
    const protectedSnapshot = join3(
      layout.indexes,
      "v3",
      "snapshots",
      metadata.projectKey,
      metadata.cursorScopeKey,
      metadata.snapshotId.slice("sha256:".length)
    );
    await pruneScopeIndexesUnderLock(layout, protectedSnapshot, {
      now: () => accessedAt,
      ...hooks.prospectivePruneLimits?.()
    }, hooks, {
      projectKey: metadata.projectKey,
      cursorScopeKey: metadata.cursorScopeKey,
      bytes: Buffer.byteLength(accessRecordBytes(record2), "utf8") + Number(maximumSnapshotClaimArtifactBytes),
      snapshotCount: 0
    });
    await validatePublicationClaim(layout, pruneClaim);
  };
  let previous = await readAccessRecord(layout, metadata, key, requireExisting, hooks);
  if (!previous.primaryIdentity && !previous.pendingIdentity) {
    await publishExclusiveFile(layout, path, accessRecordBytes(accessRecord(accessedAt)));
    await hooks.afterInitialAccessPublish?.(path);
    return;
  }
  if (!previous.primaryIdentity && previous.record) {
    await reserveAccessPublication(previous.record);
    await publishExclusiveFile(layout, path, accessRecordBytes(previous.record));
    previous = await readAccessRecord(layout, metadata, key, true, hooks);
  }
  if (!previous.primaryIdentity) throw new Error("Scope access registry primary record could not be recovered");
  const effectiveAccessedAt = Math.max(accessedAt, previous.record?.accessedAt ?? accessedAt);
  const record = accessRecord(effectiveAccessedAt);
  await reserveAccessPublication(record);
  if (previous.pendingIdentity) await safeRemoveExactCacheFile(layout, previous.pendingIdentity);
  await publishExclusiveFile(layout, pendingPath, accessRecordBytes(record));
  await hooks.afterAccessPendingPublish?.(pendingPath);
  await safeRemoveExactCacheFile(layout, previous.primaryIdentity);
  await hooks.afterAccessPrimaryRemove?.(path);
  await publishExclusiveFile(layout, path, accessRecordBytes(record));
  await hooks.afterAccessPrimaryPublish?.(path);
  const completed = await readAccessRecord(layout, metadata, key, true, hooks);
  if (!completed.pendingIdentity || !completed.primaryIdentity || completed.record?.accessedAt !== effectiveAccessedAt) {
    throw new Error("Scope access registry replacement did not publish both authenticated records");
  }
  await safeRemoveExactCacheFile(layout, completed.pendingIdentity);
}
async function removeAccessRecordFiles(layout, access) {
  if (access.primaryIdentity) await safeRemoveExactCacheFile(layout, access.primaryIdentity);
  if (access.pendingIdentity) await safeRemoveExactCacheFile(layout, access.pendingIdentity);
}
async function persistScopeIndex(input, hooks = nodeScopeStoreIo) {
  const nowMs = hooks.nowMs ?? (() => performance3.now());
  const acquisitionDeadline = nowMs() + PUBLICATION_CLAIM_WAIT_MS;
  const layout = await prepareSecureCache(input.options, input.projectRoot);
  const projectKey = scopeProjectKey(input.projectRoot);
  const scopeKey = scopePathsKey(input.scopePaths);
  const cursorScopeKey = scopeCursorKey(input.projectRoot, scopeKey);
  if (!/^sha256:[a-f0-9]{64}$/u.test(input.snapshotId)) throw new Error("Scope snapshot ID is invalid");
  const parent = join3(layout.indexes, "v3", "snapshots", projectKey, cursorScopeKey);
  await createSecureCacheDirectory(layout, parent);
  const target = join3(parent, input.snapshotId.slice("sha256:".length));
  const expected = serializeScopeIndex(input);
  const prospectiveSnapshotBytes = Buffer.byteLength(expected.metadata, "utf8") + Buffer.byteLength(expected.files, "utf8") + Buffer.byteLength(expected.evidence, "utf8") + (expected.details === void 0 ? 0 : Buffer.byteLength(expected.details, "utf8"));
  const prospectiveBytes = prospectiveSnapshotBytes + accessRecordPhysicalBytes(expected.parsedMetadata, expected.parsedMetadata.createdAt) + Number(maximumSnapshotClaimArtifactBytes);
  const persistedResult = (metadata) => ({
    cacheRoot: target,
    scopeKey: metadata.scopeKey,
    cursorScopeKey: metadata.cursorScopeKey,
    snapshotId: metadata.snapshotId,
    createdAt: metadata.createdAt,
    expiresAt: metadata.expiresAt
  });
  const existingResult = async () => {
    const useClaim = await acquireSnapshotUseClaim(layout, target, hooks);
    let recreate = false;
    let value;
    let failure;
    try {
      const validated = await validateSnapshotDirectory(layout, target, {
        projectKey,
        scopeKey,
        cursorScopeKey,
        scopePaths: input.scopePaths,
        snapshotId: input.snapshotId
      });
      const now = logicalNow(input);
      if (now >= validated.metadata.expiresAt) {
        const key = await loadOrCreateAccessKey(layout);
        const access = await readAccessRecord(layout, validated.metadata, key, false, hooks);
        await validatePublicationClaim(layout, useClaim);
        await validateSecurePathIdentity(layout, validated.identity);
        await safeRemoveOwnedSnapshotDirectory(layout, validated.identity, true);
        await removeAccessRecordFiles(layout, access);
        recreate = true;
      } else {
        await writeAccessRecord(layout, validated.metadata, now, true, hooks);
        value = persistedResult(validated.metadata);
      }
    } catch (error) {
      failure = error;
    }
    try {
      await safeRemoveOwnedPublicationClaim(layout, useClaim);
    } catch (cleanupError) {
      if (failure !== void 0) {
        throw new AggregateError([failure, cleanupError], "Scope snapshot reuse and claim cleanup both failed", { cause: failure });
      }
      throw cleanupError;
    }
    if (failure !== void 0) throw failure;
    if (recreate) return persistScopeIndex(input, hooks);
    if (!value) throw new Error("Scope snapshot reuse did not produce a result");
    await pruneScopeIndexes(layout, value.cacheRoot, { now: () => logicalNow(input) }, hooks);
    return value;
  };
  const claimEpoch = {};
  let claim;
  while (!claim) {
    const resolution = await reconcileSnapshotPublication(target, expected, hooks, layout, acquisitionDeadline, nowMs, claimEpoch);
    if (resolution === "matching") return existingResult();
    if (resolution === "deadline") {
      await finalReconcileSnapshotPublication(target, expected, hooks, layout, true, claimEpoch);
      return existingResult();
    }
    await hooks.beforeTargetClaimAcquire?.();
    if (nowMs() >= acquisitionDeadline) {
      await finalReconcileSnapshotPublication(target, expected, hooks, layout, true, claimEpoch);
      return existingResult();
    }
    try {
      const acquired = await claimOwnedSnapshotDirectory(layout, target);
      if (nowMs() >= acquisitionDeadline) {
        await safeRemoveOwnedPublicationClaim(layout, acquired);
        await finalReconcileSnapshotPublication(target, expected, hooks, layout, true, claimEpoch);
        return existingResult();
      }
      claim = acquired;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      await hooks.afterTargetClaimCollision?.();
      if (nowMs() >= acquisitionDeadline) {
        await finalReconcileSnapshotPublication(target, expected, hooks, layout, true, claimEpoch);
        return existingResult();
      }
    }
  }
  let build;
  let pruneClaim;
  let publishedIdentity;
  let result;
  let primaryError;
  try {
    await hooks.afterTargetClaim?.(claim);
    await validatePublicationClaim(layout, claim);
    pruneClaim = await acquireSnapshotUseClaim(layout, scopePruneLockTarget(layout), hooks);
    await validatePublicationClaim(layout, pruneClaim);
    await pruneScopeIndexesUnderLock(layout, void 0, {
      now: () => logicalNow(input),
      ...hooks.prospectivePruneLimits?.()
    }, hooks, {
      projectKey,
      cursorScopeKey,
      bytes: prospectiveBytes,
      snapshotCount: 1
    });
    await validatePublicationClaim(layout, pruneClaim);
    await validatePublicationClaim(layout, claim);
    await hooks.beforeBuild?.(parent);
    build = await createOwnedBuildDirectory(layout, parent);
    const writes = await Promise.allSettled([
      writeBuildShard(layout, join3(build.path, "files.jsonl"), expected.files, hooks),
      writeBuildShard(layout, join3(build.path, "evidence.jsonl"), expected.evidence, hooks),
      writeBuildShard(layout, join3(build.path, "metadata.json"), expected.metadata, hooks),
      ...expected.details === void 0 ? [] : [writeBuildShard(layout, join3(build.path, "details.jsonl"), expected.details, hooks)]
    ]);
    const failedWrite = writes.find((write) => write.status === "rejected");
    if (failedWrite) throw failedWrite.reason;
    await hooks.afterShardWrites?.(build);
    await validateSecurePathIdentity(layout, build);
    const shardPaths = [
      join3(build.path, "files.jsonl"),
      join3(build.path, "evidence.jsonl"),
      join3(build.path, "metadata.json"),
      ...expected.details === void 0 ? [] : [join3(build.path, "details.jsonl")]
    ];
    await validateCacheFiles(layout, shardPaths);
    await exactSnapshotEntries(build.path, expected.parsedMetadata);
    await validateSecurePathIdentity(layout, build);
    await validateSecurePathIdentity(layout, build);
    await hooks.beforePublish?.(build, target);
    await validateSecurePathIdentity(layout, build);
    await validatePublicationClaim(layout, claim);
    await validatePublicationClaim(layout, pruneClaim);
    const hiddenBuild = await inspectExistingSnapshot(build.path, expected, {}, layout);
    if (hiddenBuild !== "matching") throw new Error("Scope snapshot build contents are invalid before publication");
    await validateSecurePathIdentity(layout, build);
    await validatePublicationClaim(layout, claim);
    await writeAccessRecord(
      layout,
      expected.parsedMetadata,
      expected.parsedMetadata.createdAt,
      false,
      hooks,
      pruneClaim
    );
    await validateSecurePathIdentity(layout, build);
    await validatePublicationClaim(layout, claim);
    await validatePublicationClaim(layout, pruneClaim);
    publishedIdentity = await publishOwnedBuildDirectory(layout, build, target, claim, {
      afterRename: hooks.afterBuildRename
    });
    const published = await inspectExistingSnapshot(target, expected, hooks, layout);
    if (published !== "matching") throw new Error("Published scope index snapshot is invalid");
    await hooks.afterPublish?.(target);
    await validateSecurePathIdentity(layout, publishedIdentity);
    const afterHook = await inspectExistingSnapshot(target, expected, {}, layout);
    if (afterHook !== "matching") throw new Error("Published scope index snapshot changed after publication hook");
    await validatePublicationClaim(layout, pruneClaim);
    result = persistedResult(expected.parsedMetadata);
  } catch (error) {
    primaryError = error;
  }
  const cleanupErrors = [];
  if (primaryError !== void 0 && publishedIdentity) {
    try {
      await safeRemoveOwnedSnapshotDirectory(layout, publishedIdentity);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (primaryError !== void 0) {
    try {
      const key = await loadOrCreateAccessKey(layout);
      const access = await readAccessRecord(layout, expected.parsedMetadata, key, false, hooks);
      await removeAccessRecordFiles(layout, access);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (build) {
    try {
      await hooks.beforeCleanup?.(build);
      await safeRemoveOwnedBuildDirectory(layout, build);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (pruneClaim) {
    try {
      await safeRemoveOwnedPublicationClaim(layout, pruneClaim);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  try {
    await safeRemoveOwnedPublicationClaim(layout, claim);
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (primaryError !== void 0) {
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [primaryError, ...cleanupErrors],
        "Scope snapshot persistence failed and cleanup was ambiguous",
        { cause: primaryError }
      );
    }
    throw primaryError;
  }
  if (cleanupErrors.length === 1) throw cleanupErrors[0];
  if (cleanupErrors.length > 1) throw new AggregateError(cleanupErrors, "Scope snapshot cleanup was ambiguous");
  if (!result) throw new Error("Scope snapshot persistence did not produce a result");
  return result;
}
async function acquireSnapshotUseClaim(layout, target, hooks = {}) {
  const nowMs = hooks.nowMs ?? (() => performance3.now());
  const deadline = nowMs() + PUBLICATION_CLAIM_WAIT_MS;
  for (; ; ) {
    if (nowMs() >= deadline) throw new Error("Scope snapshot use claim acquisition timed out");
    try {
      return await claimOwnedSnapshotDirectory(layout, target);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const observation = await observeOwnedSnapshotPublicationClaim(layout, target);
    if (observation.state === "absent") {
      if (nowMs() >= deadline) throw new Error("Scope snapshot use claim acquisition timed out");
      continue;
    }
    const liveness = publicationClaimLiveness(observation.claim);
    if (liveness === "dead") {
      await safeRemoveOwnedPublicationClaim(layout, observation.claim);
      await hooks.afterStaleClaimRelease?.();
      if (nowMs() >= deadline) throw new Error("Scope snapshot use claim acquisition timed out");
      continue;
    }
    if (liveness === "ambiguous") throw new Error("Scope snapshot use claim owner liveness is ambiguous");
    if (nowMs() >= deadline) throw new Error("Scope snapshot use claim acquisition timed out");
    await new Promise((accept) => setTimeout(accept, 25));
  }
}
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}
async function loadScopeIndex(input, hooks = nodeScopeStoreIo) {
  let claim;
  let loadedResult;
  let snapshotDirectoryObserved = false;
  let primaryError;
  try {
    if (!/^sha256:[a-f0-9]{64}$/u.test(input.snapshotId)) throw new Error("Scope snapshot ID is invalid");
    const layout = await prepareSecureCache(input.options, input.projectRoot);
    const projectKey = scopeProjectKey(input.projectRoot);
    const rawScopeKey = input.scopePaths === void 0 ? void 0 : scopePathsKey(input.scopePaths);
    const cursorScopeKey = input.scopePaths === void 0 ? input.scopeKey : scopeCursorKey(input.projectRoot, rawScopeKey);
    if (typeof cursorScopeKey !== "string" || !/^[a-f0-9]{64}$/u.test(cursorScopeKey)) {
      throw new Error("Scope snapshot cursor binding is invalid");
    }
    const target = join3(
      layout.indexes,
      "v3",
      "snapshots",
      projectKey,
      cursorScopeKey,
      input.snapshotId.slice("sha256:".length)
    );
    claim = await acquireSnapshotUseClaim(layout, target, hooks);
    await validatePublicationClaim(layout, claim);
    await captureSecurePathIdentity(layout, target, "directory");
    snapshotDirectoryObserved = true;
    const validated = await validateSnapshotDirectory(layout, target, {
      projectKey,
      cursorScopeKey,
      snapshotId: input.snapshotId,
      ...rawScopeKey === void 0 ? {} : { scopeKey: rawScopeKey, scopePaths: input.scopePaths }
    }, hooks);
    await hooks.afterLoadIdentity?.(validated.identity);
    await validatePublicationClaim(layout, claim);
    await validateSecurePathIdentity(layout, validated.identity);
    const now = input.now ?? input.options.now?.() ?? Date.now();
    if (!Number.isSafeInteger(now) || now < 0) throw new Error("Scope snapshot validation clock is invalid");
    if (now >= validated.metadata.expiresAt) throw new ScopeSnapshotRestartError("expired");
    await writeAccessRecord(layout, validated.metadata, now, true, hooks);
    await validatePublicationClaim(layout, claim);
    await validateSecurePathIdentity(layout, validated.identity);
    loadedResult = deepFreeze({
      cacheRoot: target,
      snapshotId: validated.metadata.snapshotId,
      createdAt: validated.metadata.createdAt,
      expiresAt: validated.metadata.expiresAt,
      scopeKey: validated.metadata.scopeKey,
      cursorScopeKey: validated.metadata.cursorScopeKey,
      scopePaths: validated.metadata.scopePaths,
      files: validated.files,
      evidence: validated.evidence,
      ...validated.details === void 0 ? {} : { details: validated.details },
      candidateModules: validated.metadata.candidateModules,
      omissions: validated.metadata.omissions,
      totals: validated.metadata.totals,
      ...validated.metadata.driftSummary === void 0 ? {} : { driftSummary: validated.metadata.driftSummary }
    });
  } catch (error) {
    primaryError = error;
  } finally {
    if (claim) {
      try {
        await hooks.beforeUseClaimCleanup?.(claim);
        await safeRemoveOwnedPublicationClaim(await prepareSecureCache(input.options, input.projectRoot), claim);
      } catch (cleanupError) {
        if (primaryError !== void 0) {
          primaryError = new AggregateError([primaryError, cleanupError], "Scope snapshot load and claim cleanup both failed", { cause: primaryError });
        } else {
          primaryError = cleanupError;
        }
      }
    }
  }
  if (primaryError instanceof ScopeSnapshotRestartError) throw primaryError;
  if (primaryError !== void 0) {
    throw new ScopeSnapshotRestartError(
      missingPath(primaryError) && !snapshotDirectoryObserved ? "missing" : "corrupt",
      { cause: primaryError }
    );
  }
  if (!loadedResult) throw new ScopeSnapshotRestartError("corrupt");
  return loadedResult;
}
var defaultScopePruneLimits = Object.freeze({
  ttlMs: scopeSnapshotLifetimeMs,
  maxSnapshotsPerScope: 8,
  maxProjectBytes: scopeProjectByteLimit,
  maxGlobalBytes: scopeGlobalByteLimit
});
function pruneLimit(name2, value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name2} must be a non-negative safe integer`);
  return value;
}
function scopePruneLockTarget(layout) {
  return join3(layout.indexes, "v3", "prune", hashKey("scope-index-prune-lock"));
}
function sameResolvedPath2(left, right) {
  const leftPath = resolve4(left);
  const rightPath = resolve4(right);
  return process.platform === "win32" ? leftPath.toLocaleLowerCase("en-US") === rightPath.toLocaleLowerCase("en-US") : leftPath === rightPath;
}
async function boundedDirectoryEntries(path, work, deadline) {
  const values = [];
  let directory;
  try {
    directory = await opendir3(path);
  } catch (error) {
    if (missingPath(error)) return values;
    throw error;
  }
  try {
    for await (const entry of directory) {
      deadline.check();
      work.consume();
      values.push({ name: entry.name, directory: entry.isDirectory() });
    }
  } finally {
    await directory.close().catch(() => void 0);
  }
  return values.sort((left, right) => left.name.localeCompare(right.name, "en-US"));
}
var canonicalUuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
var publicationNoncePattern = "[a-f0-9]{32}";
var snapshotBuildPattern = new RegExp(`^\\.build-${canonicalUuidPattern}$`, "u");
var snapshotClaimPattern = /^\.publish-([a-f0-9]{64})$/u;
var snapshotClaimReleasePattern = new RegExp(`^\\.publish-[a-f0-9]{64}\\.release-${publicationNoncePattern}$`, "u");
var snapshotClaimInitializationPattern = new RegExp(`^\\.claim-${canonicalUuidPattern}\\.tmp$`, "u");
var accessClaimReleasePattern = new RegExp(
  `^\\.publish-[a-f0-9]{64}\\.json(?:\\.pending)?\\.release-${publicationNoncePattern}$`,
  "u"
);
var accessClaimInitializationPattern = new RegExp(`^\\.claim-${canonicalUuidPattern}\\.tmp$`, "u");
var accessPublicationTemporaryPattern = new RegExp(`^\\.${canonicalUuidPattern}\\.tmp$`, "u");
var maximumSnapshotClaimArtifactBytes = 4096n;
function samePublicationArtifactVersion(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.gid === right.gid && left.mode === right.mode && left.nlink === right.nlink && left.size === right.size && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs && left.isFile() && right.isFile() && !left.isSymbolicLink() && !right.isSymbolicLink();
}
function isPublicationArtifactSettlementTransition(left, right) {
  return (left.nlink === 1n || left.nlink === 2n) && (right.nlink === 1n || right.nlink === 2n) && left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.gid === right.gid && left.mode === right.mode && left.size === right.size && left.mtimeNs === right.mtimeNs && left.isFile() && right.isFile() && !left.isSymbolicLink() && !right.isSymbolicLink();
}
var ScopeInventorySettlementRestart = class extends Error {
  constructor(message, artifactPath, epochEnded = false) {
    super(message);
    this.artifactPath = artifactPath;
    this.epochEnded = epochEnded;
  }
};
async function validateBoundedPublicationArtifact(path, allowLinkedInitialization, hooks) {
  let metadata;
  try {
    metadata = await lstat4(path, { bigint: true });
  } catch (error) {
    if (missingPath(error)) {
      throw new ScopeInventorySettlementRestart("Scope publication artifact settled during inventory", path, true);
    }
    throw error;
  }
  const allowedLinks = allowLinkedInitialization ? metadata.nlink === 1n || metadata.nlink === 2n : metadata.nlink === 1n;
  if (!allowedLinks || metadata.size < 0n || metadata.size > maximumSnapshotClaimArtifactBytes) {
    throw new Error("Scope snapshot publication artifact metadata is invalid");
  }
  assertSecureOwnerFileMetadata(metadata, path, metadata.nlink);
  await hooks.afterPublicationArtifactStat?.(path);
  return { path, metadata, bytes: Number(metadata.size) };
}
async function validatePublicationArtifactFinalVersion(artifact) {
  let final;
  try {
    final = await lstat4(artifact.path, { bigint: true });
  } catch (error) {
    if (missingPath(error)) {
      throw new ScopeInventorySettlementRestart(
        "Scope publication artifact settled during inventory",
        artifact.path,
        true
      );
    }
    throw error;
  }
  if (!samePublicationArtifactVersion(artifact.metadata, final)) {
    if (isPublicationArtifactSettlementTransition(artifact.metadata, final)) {
      throw new ScopeInventorySettlementRestart("Scope publication artifact metadata settled during inventory");
    }
    throw new Error("Scope snapshot publication artifact identity or metadata changed during inventory");
  }
}
async function reconcileSnapshotClaimArtifact(layout, scopePath, snapshotId, deadline) {
  const target = join3(scopePath, snapshotId);
  const observation = await observeOwnedSnapshotPublicationClaim(layout, target);
  deadline.check();
  if (observation.state === "absent") return void 0;
  const liveness = publicationClaimLiveness(observation.claim);
  if (liveness === "ambiguous") throw new Error("Scope prune found an ambiguously owned snapshot claim");
  if (liveness === "dead") {
    await safeRemoveOwnedPublicationClaim(layout, observation.claim);
    deadline.check();
    return void 0;
  }
  await validatePublicationClaim(layout, observation.claim);
  deadline.check();
  return observation.claim;
}
function bindInventoryPublicationClaim(claims, path, claim) {
  const observed = claims.get(path);
  if (observed && !samePublicationClaimEpoch(observed, claim)) {
    throw new Error("Scope publication claim identity or owner metadata changed while inventory restarted");
  }
  claims.set(path, claim);
}
async function sweepOrphanAccessRecords(layout, work, deadline, key, hooks, observedPublicationClaims) {
  const activeArtifactBytes = /* @__PURE__ */ new Map();
  const accessRoot = join3(layout.indexes, "v3", "access");
  for (const project of await boundedDirectoryEntries(accessRoot, work, deadline)) {
    if (!project.directory || !/^[a-f0-9]{64}$/u.test(project.name)) {
      throw new Error("Scope access registry contains an unexpected project entry");
    }
    const projectPath = join3(accessRoot, project.name);
    for (const scope of await boundedDirectoryEntries(projectPath, work, deadline)) {
      if (!scope.directory || !/^[a-f0-9]{64}$/u.test(scope.name)) {
        throw new Error("Scope access registry contains an unexpected scope entry");
      }
      const scopePath = join3(projectPath, scope.name);
      for (const entry of await boundedDirectoryEntries(scopePath, work, deadline)) {
        const match = /^([a-f0-9]{64})\.json(?:\.pending)?$/u.exec(entry.name);
        const publication = /^\.publish-([a-f0-9]{64}\.json(?:\.pending)?)$/u.exec(entry.name);
        if (publication) {
          if (entry.directory) throw new Error("Scope access publication claim is not a regular file");
          const artifactPath = join3(scopePath, entry.name);
          const artifact = await validateBoundedPublicationArtifact(artifactPath, true, hooks);
          const state = await reconcileCacheFilePublication(layout, join3(scopePath, publication[1]));
          if (state.state === "active") {
            bindInventoryPublicationClaim(observedPublicationClaims, artifactPath, state.claim);
            await validatePublicationArtifactFinalVersion(artifact);
            activeArtifactBytes.set(project.name, (activeArtifactBytes.get(project.name) ?? 0) + artifact.bytes);
          } else {
            throw new ScopeInventorySettlementRestart(
              "Scope access publication completed during inventory",
              artifactPath,
              true
            );
          }
          deadline.check();
          continue;
        }
        if (accessClaimInitializationPattern.test(entry.name) || accessPublicationTemporaryPattern.test(entry.name) || accessClaimReleasePattern.test(entry.name)) {
          if (entry.directory) throw new Error("Scope access publication artifact is not a regular file");
          await validateBoundedPublicationArtifact(join3(scopePath, entry.name), true, hooks);
          throw new ScopeInventorySettlementRestart("Scope access publication is settling");
        }
        if (entry.directory || !match) throw new Error("Scope access registry contains an unexpected record entry");
        const path = join3(scopePath, entry.name);
        const access = await readAccessFile(layout, path, void 0, key, hooks);
        if (!access || access.record.projectKey !== project.name || access.record.cursorScopeKey !== scope.name || access.record.snapshotId !== `sha256:${match[1]}`) {
          throw new Error("Scope access registry path binding is invalid");
        }
        const target = join3(layout.indexes, "v3", "snapshots", project.name, scope.name, match[1]);
        let targetExists = true;
        try {
          await lstat4(target, { bigint: true });
        } catch (error) {
          if (!missingPath(error)) throw error;
          targetExists = false;
        }
        deadline.check();
        if (!targetExists) await safeRemoveExactCacheFile(layout, access.identity);
      }
    }
  }
  return activeArtifactBytes;
}
async function inventoryScopeSnapshotsAttempt(layout, hooks, work, joinWork, deadline, key, observedPublicationClaims) {
  const result = [];
  const consumeJoinWork = (kind) => {
    deadline.check();
    joinWork.consume();
    hooks.onInventoryJoinWork?.(kind);
    deadline.check();
  };
  const snapshots = join3(layout.indexes, "v3", "snapshots");
  const inventoryHooks = {
    ...hooks,
    beforeReadShard: async (path) => {
      deadline.check();
      await hooks.beforeReadShard?.(path);
      deadline.check();
    },
    onBoundedFileRead: async (path, bytes) => {
      deadline.check();
      await hooks.onBoundedFileRead?.(path, bytes);
      deadline.check();
    },
    beforeShardFinalIdentity: async (identity) => {
      deadline.check();
      await hooks.beforeShardFinalIdentity?.(identity);
      deadline.check();
    },
    afterSnapshotReads: async (target) => {
      deadline.check();
      await hooks.afterSnapshotReads?.(target);
      deadline.check();
    },
    afterPublicationArtifactStat: async (path) => {
      deadline.check();
      await hooks.afterPublicationArtifactStat?.(path);
      deadline.check();
    }
  };
  const projectArtifactBytes = await sweepOrphanAccessRecords(
    layout,
    work,
    deadline,
    key,
    inventoryHooks,
    observedPublicationClaims
  );
  for (const project of await boundedDirectoryEntries(snapshots, work, deadline)) {
    if (!/^[a-f0-9]{64}$/u.test(project.name)) {
      throw new Error("Scope snapshot namespace contains an unexpected project entry");
    }
    if (!project.directory) throw new Error("Scope snapshot project entry is not a directory");
    const projectPath = join3(snapshots, project.name);
    for (const scope of await boundedDirectoryEntries(projectPath, work, deadline)) {
      if (!/^[a-f0-9]{64}$/u.test(scope.name)) {
        throw new Error("Scope snapshot namespace contains an unexpected scope entry");
      }
      if (!scope.directory) throw new Error("Scope snapshot scope entry is not a directory");
      const scopePath = join3(projectPath, scope.name);
      const activeClaimBytes = /* @__PURE__ */ new Map();
      const scopeEntries = /* @__PURE__ */ new Map();
      for (const snapshot2 of await boundedDirectoryEntries(scopePath, work, deadline)) {
        if (snapshotBuildPattern.test(snapshot2.name)) {
          if (!snapshot2.directory) throw new Error("Scope snapshot build entry is not a directory");
          const build = await captureSecurePathIdentity(layout, join3(scopePath, snapshot2.name), "directory");
          deadline.check();
          await safeRemoveOwnedBuildDirectory(layout, build);
          deadline.check();
          continue;
        }
        const claim = snapshotClaimPattern.exec(snapshot2.name);
        if (claim) {
          if (snapshot2.directory) throw new Error("Scope snapshot publication claim is not a regular file");
          const artifactPath = join3(scopePath, snapshot2.name);
          const artifact = await validateBoundedPublicationArtifact(artifactPath, true, inventoryHooks);
          const activeClaim = await reconcileSnapshotClaimArtifact(layout, scopePath, claim[1], deadline);
          if (activeClaim) {
            bindInventoryPublicationClaim(observedPublicationClaims, artifactPath, activeClaim);
            await validatePublicationArtifactFinalVersion(artifact);
            consumeJoinWork("active-claim");
            if (activeClaimBytes.has(claim[1])) {
              throw new Error("Scope snapshot inventory contains an ambiguous active claim key");
            }
            activeClaimBytes.set(claim[1], artifact.bytes);
          } else {
            throw new ScopeInventorySettlementRestart(
              "Scope snapshot publication completed during inventory",
              artifactPath,
              true
            );
          }
          continue;
        }
        if (snapshotClaimReleasePattern.test(snapshot2.name)) {
          if (snapshot2.directory) throw new Error("Scope snapshot publication release artifact is not a regular file");
          await validateBoundedPublicationArtifact(join3(scopePath, snapshot2.name), false, inventoryHooks);
          throw new ScopeInventorySettlementRestart("Scope snapshot publication release is settling");
        }
        if (snapshotClaimInitializationPattern.test(snapshot2.name)) {
          if (snapshot2.directory) throw new Error("Scope snapshot publication initialization artifact is not a regular file");
          await validateBoundedPublicationArtifact(join3(scopePath, snapshot2.name), true, inventoryHooks);
          throw new ScopeInventorySettlementRestart("Scope snapshot publication initialization is settling");
        }
        if (!/^[a-f0-9]{64}$/u.test(snapshot2.name)) {
          throw new Error("Scope snapshot namespace contains an unexpected snapshot entry");
        }
        if (!snapshot2.directory) throw new Error("Scope snapshot entry is not a directory");
        const target = join3(scopePath, snapshot2.name);
        const observation = await observeOwnedSnapshotPublicationClaim(layout, target);
        if (observation.state === "owned") {
          const liveness = publicationClaimLiveness(observation.claim);
          if (liveness === "ambiguous") throw new Error("Scope prune found an ambiguously owned snapshot claim");
          if (liveness === "dead") {
            await safeRemoveOwnedPublicationClaim(layout, observation.claim);
          } else await validatePublicationClaim(layout, observation.claim);
        }
        try {
          const validated = await validateSnapshotDirectory(layout, target, {
            projectKey: project.name,
            cursorScopeKey: scope.name,
            snapshotId: `sha256:${snapshot2.name}`
          }, inventoryHooks);
          const access = await readAccessRecord(layout, validated.metadata, key, true, inventoryHooks);
          if (!access.record) throw new Error("Scope access registry record is missing");
          const bytes = validated.metadataBytes + validated.metadata.shards.files.bytes + validated.metadata.shards.evidence.bytes + (validated.metadata.shards.details?.bytes ?? 0) + access.physicalBytes;
          const entry = {
            path: target,
            identity: validated.identity,
            metadata: validated.metadata,
            accessedAt: access.record.accessedAt,
            accessBytes: access.physicalBytes,
            bytes
          };
          consumeJoinWork("snapshot");
          if (scopeEntries.has(snapshot2.name)) {
            throw new Error("Scope snapshot inventory contains an ambiguous snapshot key");
          }
          scopeEntries.set(snapshot2.name, entry);
          result.push(entry);
        } catch (error) {
          throw new Error(`Scope snapshot cannot be safely inventoried: ${target}`, { cause: error });
        }
      }
      for (const [snapshotId, bytes] of activeClaimBytes) {
        consumeJoinWork("merge");
        const entry = scopeEntries.get(snapshotId);
        if (entry) entry.bytes += bytes;
        else projectArtifactBytes.set(project.name, (projectArtifactBytes.get(project.name) ?? 0) + bytes);
      }
    }
  }
  return { entries: result, projectArtifactBytes };
}
async function inventoryScopeSnapshots(layout, hooks = nodeScopeStoreIo) {
  const maximumInventoryEntries2 = keeperLimits.scan.maxFiles * 4 + 1024;
  const work = new CounterBudget("Scope prune directory work", maximumInventoryEntries2);
  const joinWork = new CounterBudget("Scope prune inventory join work", maximumInventoryEntries2 * 2);
  const deadline = new DeadlineBudget("Scope prune", 3e4, hooks.inventoryNowMs);
  const key = await loadOrCreateAccessKey(layout);
  const observedPublicationClaims = /* @__PURE__ */ new Map();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await inventoryScopeSnapshotsAttempt(
        layout,
        hooks,
        work,
        joinWork,
        deadline,
        key,
        observedPublicationClaims
      );
    } catch (error) {
      if (!(error instanceof ScopeInventorySettlementRestart)) throw error;
      if (error.epochEnded && error.artifactPath) observedPublicationClaims.delete(error.artifactPath);
      await hooks.afterInventorySettlementRestart?.(error.artifactPath, error.epochEnded);
      deadline.check();
    }
  }
  throw new Error("Scope publication artifacts did not stabilize during bounded inventory");
}
function inventoryOrder(left, right) {
  return left.accessedAt - right.accessedAt || left.metadata.createdAt - right.metadata.createdAt || left.path.localeCompare(right.path, "en-US");
}
async function tryEvictScopeSnapshot(layout, entry, hooks) {
  let claim;
  try {
    claim = await claimOwnedSnapshotDirectory(layout, entry.path);
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
  try {
    await validatePublicationClaim(layout, claim);
    await validateSecurePathIdentity(layout, entry.identity);
    const key = await loadOrCreateAccessKey(layout);
    const currentAccess = await readAccessRecord(layout, entry.metadata, key, true, hooks);
    if (!currentAccess.record || !currentAccess.primaryIdentity && !currentAccess.pendingIdentity || currentAccess.record.accessedAt !== entry.accessedAt || currentAccess.physicalBytes !== entry.accessBytes) return false;
    await hooks.beforeEvict?.(entry.identity);
    await validatePublicationClaim(layout, claim);
    await validateSecurePathIdentity(layout, entry.identity);
    if (currentAccess.primaryIdentity) await validateSecurePathIdentity(layout, currentAccess.primaryIdentity);
    if (currentAccess.pendingIdentity) await validateSecurePathIdentity(layout, currentAccess.pendingIdentity);
    await safeRemoveOwnedSnapshotDirectory(layout, entry.identity, true);
    await removeAccessRecordFiles(layout, currentAccess);
    return true;
  } finally {
    await safeRemoveOwnedPublicationClaim(layout, claim);
  }
}
async function pruneScopeIndexesUnderLock(layout, protectedSnapshot, overrides = {}, hooks = nodeScopeStoreIo, reservation) {
  const now = overrides.now?.() ?? Date.now();
  const ttlMs = pruneLimit("Scope snapshot TTL", overrides.ttlMs ?? defaultScopePruneLimits.ttlMs);
  const maxSnapshotsPerScope = pruneLimit(
    "Maximum snapshots per scope",
    overrides.maxSnapshotsPerScope ?? defaultScopePruneLimits.maxSnapshotsPerScope
  );
  const maxProjectBytes = pruneLimit("Maximum project scope bytes", overrides.maxProjectBytes ?? defaultScopePruneLimits.maxProjectBytes);
  const maxGlobalBytes = pruneLimit("Maximum global scope bytes", overrides.maxGlobalBytes ?? defaultScopePruneLimits.maxGlobalBytes);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Scope prune clock is invalid");
  if (reservation && (!Number.isSafeInteger(reservation.bytes) || reservation.bytes < 0 || reservation.snapshotCount !== 0 && reservation.snapshotCount !== 1)) {
    throw new Error("Prospective scope snapshot bytes are invalid");
  }
  if (reservation && (reservation.bytes > maxProjectBytes || reservation.bytes > maxGlobalBytes || maxSnapshotsPerScope < reservation.snapshotCount)) {
    throw new Error("Prospective scope snapshot cannot fit within retention quotas");
  }
  const inventory = await inventoryScopeSnapshots(layout, hooks);
  const entries = inventory.entries;
  const artifactGlobalBytes = [...inventory.projectArtifactBytes.values()].reduce((sum, bytes) => sum + bytes, 0);
  if ([...inventory.projectArtifactBytes.values()].some((bytes) => bytes > maxProjectBytes) || artifactGlobalBytes > maxGlobalBytes) {
    throw new Error("Active scope publication artifacts exceed retention quotas");
  }
  const protectedPath = protectedSnapshot === void 0 ? void 0 : resolve4(protectedSnapshot);
  const removable = (entry) => protectedPath === void 0 || !sameResolvedPath2(entry.path, protectedPath);
  const marked = /* @__PURE__ */ new Set();
  const mark = (entry) => {
    if (removable(entry)) marked.add(entry.path);
  };
  for (const entry of entries) {
    if (now >= entry.metadata.createdAt + ttlMs) mark(entry);
  }
  const byScope = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const key = `${entry.metadata.projectKey}:${entry.metadata.cursorScopeKey}`;
    const group = byScope.get(key) ?? [];
    group.push(entry);
    byScope.set(key, group);
  }
  for (const group of [...byScope.values()]) {
    const retained2 = group.filter((entry) => !marked.has(entry.path)).sort(inventoryOrder);
    const reserved = reservation && group[0]?.metadata.projectKey === reservation.projectKey && group[0]?.metadata.cursorScopeKey === reservation.cursorScopeKey ? reservation.snapshotCount : 0;
    let excess = retained2.length + reserved - maxSnapshotsPerScope;
    for (const entry of retained2) {
      if (excess <= 0) break;
      if (!removable(entry)) continue;
      mark(entry);
      excess -= 1;
    }
  }
  const byProject = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const group = byProject.get(entry.metadata.projectKey) ?? [];
    group.push(entry);
    byProject.set(entry.metadata.projectKey, group);
  }
  const projectKeys = /* @__PURE__ */ new Set([...byProject.keys(), ...inventory.projectArtifactBytes.keys()]);
  for (const projectKey of projectKeys) {
    const group = byProject.get(projectKey) ?? [];
    let bytes = group.filter((entry) => !marked.has(entry.path)).reduce((sum, entry) => sum + entry.bytes, 0) + (inventory.projectArtifactBytes.get(projectKey) ?? 0) + (reservation?.projectKey === projectKey ? reservation.bytes : 0);
    for (const entry of group.filter((candidate) => !marked.has(candidate.path)).sort(inventoryOrder)) {
      if (bytes <= maxProjectBytes) break;
      if (!removable(entry)) continue;
      mark(entry);
      bytes -= entry.bytes;
    }
  }
  let globalBytes = artifactGlobalBytes + entries.filter((entry) => !marked.has(entry.path)).reduce((sum, entry) => sum + entry.bytes, 0) + (reservation?.bytes ?? 0);
  for (const entry of entries.filter((candidate) => !marked.has(candidate.path)).sort(inventoryOrder)) {
    if (globalBytes <= maxGlobalBytes) break;
    if (!removable(entry)) continue;
    mark(entry);
    globalBytes -= entry.bytes;
  }
  const removed = [];
  const removedSet = /* @__PURE__ */ new Set();
  let retainedBytes = artifactGlobalBytes + entries.reduce((sum, entry) => sum + entry.bytes, 0);
  const retainedScopeCounts = /* @__PURE__ */ new Map();
  const retainedProjectByteCounts = /* @__PURE__ */ new Map();
  for (const [projectKey, bytes] of inventory.projectArtifactBytes) {
    retainedProjectByteCounts.set(projectKey, bytes);
  }
  for (const entry of entries) {
    const scopeKey = `${entry.metadata.projectKey}:${entry.metadata.cursorScopeKey}`;
    retainedScopeCounts.set(scopeKey, (retainedScopeCounts.get(scopeKey) ?? 0) + 1);
    retainedProjectByteCounts.set(
      entry.metadata.projectKey,
      (retainedProjectByteCounts.get(entry.metadata.projectKey) ?? 0) + entry.bytes
    );
  }
  const reservationScopeKey = reservation ? `${reservation.projectKey}:${reservation.cursorScopeKey}` : void 0;
  const overScopeQuota = new Set([...retainedScopeCounts].flatMap(([key, count]) => count + (key === reservationScopeKey ? reservation?.snapshotCount ?? 0 : 0) > maxSnapshotsPerScope ? [key] : []));
  const overProjectQuota = new Set([...retainedProjectByteCounts].flatMap(([key, bytes]) => bytes + (reservation?.projectKey === key ? reservation.bytes : 0) > maxProjectBytes ? [key] : []));
  const entryNeedsQuotaReduction = (entry) => {
    const scopeKey = `${entry.metadata.projectKey}:${entry.metadata.cursorScopeKey}`;
    return overScopeQuota.has(scopeKey) || overProjectQuota.has(entry.metadata.projectKey) || retainedBytes + (reservation?.bytes ?? 0) > maxGlobalBytes;
  };
  for (const entry of [...entries].sort(inventoryOrder)) {
    if (!marked.has(entry.path) && !entryNeedsQuotaReduction(entry)) continue;
    if (!removable(entry)) continue;
    if (!await tryEvictScopeSnapshot(layout, entry, hooks)) continue;
    removed.push(entry.path);
    removedSet.add(entry.path);
    retainedBytes -= entry.bytes;
    const scopeKey = `${entry.metadata.projectKey}:${entry.metadata.cursorScopeKey}`;
    const scopeCount = (retainedScopeCounts.get(scopeKey) ?? 1) - 1;
    retainedScopeCounts.set(scopeKey, scopeCount);
    if (scopeCount + (scopeKey === reservationScopeKey ? reservation?.snapshotCount ?? 0 : 0) <= maxSnapshotsPerScope) {
      overScopeQuota.delete(scopeKey);
    }
    const projectBytes = (retainedProjectByteCounts.get(entry.metadata.projectKey) ?? entry.bytes) - entry.bytes;
    retainedProjectByteCounts.set(entry.metadata.projectKey, projectBytes);
    if (projectBytes + (reservation?.projectKey === entry.metadata.projectKey ? reservation.bytes : 0) <= maxProjectBytes) {
      overProjectQuota.delete(entry.metadata.projectKey);
    }
  }
  const retained = entries.filter((entry) => !removedSet.has(entry.path));
  if (reservation) {
    const retainedScopeCount = retainedScopeCounts.get(reservationScopeKey) ?? 0;
    const retainedProjectBytes = retainedProjectByteCounts.get(reservation.projectKey) ?? 0;
    if (retainedScopeCount + reservation.snapshotCount > maxSnapshotsPerScope || retainedProjectBytes + reservation.bytes > maxProjectBytes || retainedBytes + reservation.bytes > maxGlobalBytes) {
      throw new Error("Prospective scope snapshot headroom could not be established safely");
    }
  }
  return { removed, retainedBytes };
}
async function pruneScopeIndexes(layout, protectedSnapshot, overrides = {}, hooks = nodeScopeStoreIo) {
  const pruneClaim = await acquireSnapshotUseClaim(layout, scopePruneLockTarget(layout), hooks);
  try {
    await validatePublicationClaim(layout, pruneClaim);
    const result = await pruneScopeIndexesUnderLock(layout, protectedSnapshot, overrides, hooks);
    await validatePublicationClaim(layout, pruneClaim);
    return result;
  } finally {
    await safeRemoveOwnedPublicationClaim(layout, pruneClaim);
  }
}

// src/scope/index.ts
var execFile = promisify(execFileCallback);
var generatedDirectories = /* @__PURE__ */ new Set([".git", ".cache", ".next", "build", "coverage", "dist", "generated", "node_modules"]);
function createScopeOperationBudget(options) {
  const resolvedLimits = resolveKeeperLimits(options.limits);
  const limits = resolvedLimits.scan;
  const startedAt = performance4.now();
  return {
    deadline: new DeadlineBudget("cold scan", limits.deadlineMs, () => performance4.now()),
    deadlineAt: startedAt + limits.deadlineMs,
    maxFileBytes: limits.maxFileBytes,
    maxFiles: limits.maxFiles,
    maxEvidence: limits.maxEvidence,
    repositoryBytes: new ByteBudget("scope repository aggregate bytes", limits.maxAggregateBytes),
    repositoryFiles: new CounterBudget("scope repository files", limits.maxFiles),
    selectorWork: new CounterBudget(
      "scope post-scan selector work",
      resolvedLimits.pack.maxRecords * (resolvedLimits.pack.maxEvidencePerRecord * 4 + 64) + limits.maxEvidence * 4 + limits.maxFiles * 4
    )
  };
}
function consumeSelectorWork(budget, options, kind, items = 1) {
  budget.selectorWork.consume(items);
  budget.deadline.check();
  options.scopeIo?.onSelectorWork?.(kind);
}
function remainingOperationMs(budget) {
  budget.deadline.check();
  const remaining = Math.ceil(budget.deadlineAt - performance4.now());
  if (remaining <= 0) budget.deadline.check();
  return Math.max(1, remaining);
}
async function runBeforeGitHook(options, args, budget) {
  const hook = options.scopeIo?.beforeGitCommand;
  if (!hook) return;
  let timer;
  try {
    await Promise.race([
      hook(args),
      new Promise((_accept, reject) => {
        timer = setTimeout(() => reject(new Error("cold scan deadline exceeded before Git command")), remainingOperationMs(budget));
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  budget.deadline.check();
}
async function runBeforeRepositoryContentHook(options, path, budget) {
  const hook = options.scopeIo?.beforeRepositoryContentRead;
  if (!hook) return;
  let timer;
  try {
    await Promise.race([
      hook(path),
      new Promise((_accept, reject) => {
        timer = setTimeout(
          () => reject(new Error("cold scan deadline exceeded before repository content read")),
          remainingOperationMs(budget)
        );
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  budget.deadline.check();
}
async function runBeforeRepositoryStatHook(options, path, budget) {
  const hook = options.scopeIo?.beforeRepositoryFileStat;
  if (!hook) return;
  let timer;
  try {
    await Promise.race([
      hook(path),
      new Promise((_accept, reject) => {
        timer = setTimeout(
          () => reject(new Error("cold scan deadline exceeded before repository file stat")),
          remainingOperationMs(budget)
        );
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  budget.deadline.check();
}
async function runBeforeRepositoryDiscoveryHook(options, path, budget) {
  const hook = options.scopeIo?.beforeRepositoryDiscovery;
  if (!hook) return;
  let timer;
  try {
    await Promise.race([
      hook(path),
      new Promise((_accept, reject) => {
        timer = setTimeout(
          () => reject(new Error("cold scan deadline exceeded before repository discovery")),
          remainingOperationMs(budget)
        );
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  budget.deadline.check();
}
async function gitText(args, options, budget) {
  await runBeforeGitHook(options, args, budget);
  const result = await execFile("git", args, {
    encoding: "utf8",
    timeout: remainingOperationMs(budget),
    maxBuffer: 1024 * 1024
  });
  budget.deadline.check();
  return result.stdout;
}
async function gitBytes(args, maximumBytes, options, budget) {
  await runBeforeGitHook(options, args, budget);
  const result = await execFile("git", args, {
    encoding: "buffer",
    timeout: remainingOperationMs(budget),
    maxBuffer: maximumBytes
  });
  budget.deadline.check();
  return Buffer.from(result.stdout);
}
function sha256(contents) {
  return `sha256:${createHash4("sha256").update(contents).digest("hex")}`;
}
function isInside(root, target) {
  const difference = relative3(root, target);
  return difference === "" || !difference.startsWith(`..${sep3}`) && difference !== ".." && !isAbsolute3(difference);
}
async function gitRoot(path, options, budget) {
  try {
    budget.deadline.check();
    const location = (await stat(path)).isDirectory() ? path : dirname4(path);
    const stdout = await gitText(["-C", location, "rev-parse", "--show-toplevel"], options, budget);
    return await realpath4(stdout.trim());
  } catch {
    return void 0;
  }
}
async function gitMetadata(repositoryRoot, options, budget) {
  if (!repositoryRoot) return void 0;
  try {
    const [head, branch] = await Promise.all([
      gitText(["-C", repositoryRoot, "rev-parse", "HEAD"], options, budget),
      gitText(["-C", repositoryRoot, "branch", "--show-current"], options, budget)
    ]);
    const currentBranch = branch.trim();
    return { root: repositoryRoot, head: head.trim(), ...currentBranch ? { branch: currentBranch } : {} };
  } catch {
    return void 0;
  }
}
async function canonical(path) {
  try {
    return await realpath4(resolve5(path));
  } catch (error) {
    throw new Error(`Cannot resolve scope path: ${path}`, { cause: error });
  }
}
async function resolveScope(input, options = {}, budget = createScopeOperationBudget(options)) {
  if (!input.path && !input.root) throw new Error("A scope path or root is required");
  if (input.root) {
    const root = await canonical(input.root);
    const requested = input.path ?? ".";
    if (isAbsolute3(requested)) throw new Error("An absolute path is not allowed when root is supplied");
    const lexicalTarget = resolve5(root, requested);
    if (!isInside(root, lexicalTarget)) throw new Error("Scope path escapes the supplied root");
    const target2 = await canonical(lexicalTarget);
    if (!isInside(root, target2)) throw new Error("Scope path resolves outside the supplied root");
    const repositoryRoot2 = await gitRoot(target2, options, budget);
    return { root, target: target2, isGitRepository: Boolean(repositoryRoot2), repositoryRoot: repositoryRoot2 };
  }
  const target = await canonical(input.path);
  const repositoryRoot = await gitRoot(target, options, budget);
  return { root: target, target, isGitRepository: Boolean(repositoryRoot), repositoryRoot };
}
function generatedPath(path) {
  const normalized3 = path.replaceAll("\\", "/").replace(/^\.\//u, "");
  if (normalized3 === "docs/project-design" || normalized3.startsWith("docs/project-design/") || normalized3 === ".agents/skills/project-design-context" || normalized3.startsWith(".agents/skills/project-design-context/")) {
    return true;
  }
  const parts = normalized3.split("/");
  return parts.some((part) => generatedDirectories.has(part)) || /\.(?:map|min\.js)$/iu.test(path);
}
function outputPath(scope, file) {
  if (file === scope.root) return basename3(file);
  return repositoryPath2(relative3(scope.root, file));
}
function pathIdentityKey(path) {
  const absolute = resolve5(path);
  return process.platform === "win32" ? absolute.toLocaleLowerCase("en-US") : absolute;
}
function recordDiscoveryOmission(state, path, reason) {
  if (state.omissions.some((omission) => omission.reason === reason && omission.path === path)) return;
  state.omissions.push({ path, reason });
}
function checkDiscoveryBudget(state, path) {
  try {
    state.deadline.check();
  } catch {
    recordDiscoveryOmission(state, path, "deadline");
    state.stopped = true;
    return false;
  }
  state.work += 1;
  if (state.work > state.maxWork) {
    recordDiscoveryOmission(state, path, "file-limit");
    state.stopped = true;
    return false;
  }
  return true;
}
function addDiscoveredFile(state, candidate) {
  const key = pathIdentityKey(candidate);
  if (state.seen.has(key)) return true;
  if (state.files.length >= state.maxFiles) {
    recordDiscoveryOmission(state, outputPath(state.base, candidate), "file-limit");
    state.stopped = true;
    return false;
  }
  state.seen.add(key);
  state.files.push(resolve5(candidate));
  return true;
}
async function discoverRecursive(scope, state) {
  let rootMetadata;
  try {
    rootMetadata = await lstat5(scope.target);
  } catch {
    recordDiscoveryOmission(state, outputPath(state.base, scope.target), "unreadable");
    return;
  }
  if (!rootMetadata.isDirectory()) {
    addDiscoveredFile(state, scope.target);
    return;
  }
  const pending = [scope.target];
  while (pending.length > 0 && !state.stopped) {
    const directory = pending.pop();
    if (!checkDiscoveryBudget(state, outputPath(state.base, directory))) break;
    const directories = [];
    const files = [];
    try {
      const handle = await opendir4(directory, { bufferSize: 32 });
      for await (const entry of handle) {
        const fullPath = join4(directory, entry.name);
        if (!checkDiscoveryBudget(state, outputPath(state.base, fullPath))) break;
        if (generatedPath(relative3(scope.target, fullPath))) continue;
        if (entry.isDirectory()) directories.push(fullPath);
        else if (entry.isFile() || entry.isSymbolicLink()) files.push(fullPath);
      }
    } catch {
      recordDiscoveryOmission(state, outputPath(state.base, directory), "unreadable");
      continue;
    }
    files.sort((left, right) => left.localeCompare(right, "en-US"));
    for (const file of files) {
      if (!addDiscoveredFile(state, file)) break;
    }
    directories.sort((left, right) => right.localeCompare(left, "en-US"));
    pending.push(...directories);
  }
}
async function discoverTracked(scope, state) {
  if (!checkDiscoveryBudget(state, outputPath(state.base, scope.target))) return;
  let stdout;
  try {
    const maximumOutputBytes = Math.min(
      20 * 1024 * 1024,
      Math.max(64 * 1024, (state.maxWork + 1) * 64 * 1024)
    );
    stdout = await gitBytes(
      ["-C", scope.repositoryRoot, "ls-files", "-z"],
      maximumOutputBytes,
      state.options,
      state.budget
    );
  } catch (error) {
    const reason = /deadline|timed out|timeout/i.test(String(error.message)) ? "deadline" : "unreadable";
    recordDiscoveryOmission(state, outputPath(state.base, scope.target), reason);
    if (reason === "deadline") state.stopped = true;
    return;
  }
  let names;
  try {
    names = new TextDecoder3("utf-8", { fatal: true }).decode(stdout).split("\0").filter(Boolean);
  } catch {
    recordDiscoveryOmission(state, outputPath(state.base, scope.target), "unreadable");
    return;
  }
  if (names.length > state.maxWork) {
    recordDiscoveryOmission(state, outputPath(state.base, scope.target), "file-limit");
    state.stopped = true;
    return;
  }
  names.sort((left, right) => left.localeCompare(right, "en-US"));
  for (const name2 of names) {
    if (!checkDiscoveryBudget(state, name2)) break;
    if (generatedPath(name2)) continue;
    if (!safeRepositoryPath(name2)) {
      recordDiscoveryOmission(state, name2.slice(0, 4096), "unsafe");
      continue;
    }
    const candidate = resolve5(scope.repositoryRoot, ...name2.split("/"));
    if (!isInside(scope.repositoryRoot, candidate) || !isInside(scope.target, candidate)) continue;
    if (!addDiscoveredFile(state, candidate)) break;
  }
}
async function discoverScope(scope, state) {
  if (state.stopped) return;
  let metadata;
  try {
    metadata = await lstat5(scope.target);
  } catch {
    recordDiscoveryOmission(state, outputPath(state.base, scope.target), "unreadable");
    return;
  }
  if (!metadata.isDirectory()) {
    addDiscoveredFile(state, scope.target);
    return;
  }
  if (sameCanonicalAbsolutePath(scope.target, scope.root) && scope.repositoryRoot) {
    await discoverTracked(scope, state);
    return;
  }
  await discoverRecursive(scope, state);
}
async function indexScopes(base, scopes, options, budget = createScopeOperationBudget(options)) {
  const limits = resolveKeeperLimits(options.limits).scan;
  const deadline = budget.deadline;
  const state = {
    base,
    deadline,
    budget,
    options,
    maxFiles: limits.maxFiles,
    maxWork: Math.max(limits.maxFiles, Math.min(4e5, limits.maxFiles * 4)),
    files: [],
    seen: /* @__PURE__ */ new Set(),
    omissions: [],
    work: 0,
    stopped: false
  };
  const orderedScopes = [...scopes].sort((left, right) => left.target.localeCompare(right.target, "en-US"));
  for (const scope of orderedScopes) {
    await runBeforeRepositoryDiscoveryHook(options, scope.target, budget);
    await discoverScope(scope, state);
  }
  const candidates = state.files.sort((left, right) => outputPath(base, left).localeCompare(outputPath(base, right), "en-US"));
  const aggregate = budget.repositoryBytes;
  const prepared = [];
  for (const candidate of candidates) {
    let metadata;
    try {
      deadline.check();
      budget.repositoryFiles.consume();
      metadata = await lstat5(candidate, { bigint: true });
    } catch (error) {
      const message = String(error.message);
      const reason = /deadline/iu.test(message) ? "deadline" : /files?.*exceed|exceed.*files?/iu.test(message) ? "file-limit" : "unreadable";
      state.omissions.push({ path: outputPath(base, candidate), reason });
      if (reason === "deadline" || reason === "file-limit") break;
      continue;
    }
    const size = Number(metadata.size);
    if (!Number.isSafeInteger(size) || size < 0 || size > limits.maxFileBytes) {
      state.omissions.push({ path: outputPath(base, candidate), reason: "file-bytes", ...Number.isSafeInteger(size) ? { size } : {} });
      continue;
    }
    try {
      aggregate.consume(size);
    } catch {
      state.omissions.push({ path: outputPath(base, candidate), reason: "aggregate-bytes", size });
      continue;
    }
    prepared.push({ path: candidate, size });
  }
  const files = [];
  const evidence = [];
  let start = 0;
  while (start < prepared.length) {
    try {
      deadline.check();
    } catch {
      recordDiscoveryOmission(state, outputPath(base, prepared[start].path), "deadline");
      break;
    }
    const remainingEvidence = Math.max(0, limits.maxEvidence - evidence.length);
    if (remainingEvidence === 0) {
      for (const candidate of prepared.slice(start)) {
        state.omissions.push({ path: outputPath(base, candidate.path), reason: "evidence-limit", size: candidate.size });
      }
      break;
    }
    let reservableEvidence = remainingEvidence;
    const batch = [];
    while (start < prepared.length && batch.length < 8) {
      const candidate = prepared[start];
      const evidenceCapacity = candidate.size === 0 ? 0 : Math.min(candidate.size, reservableEvidence);
      if (candidate.size > 0 && evidenceCapacity === 0) break;
      batch.push({ ...candidate, evidenceCapacity });
      start += 1;
      reservableEvidence -= evidenceCapacity;
      if (evidenceCapacity < candidate.size) break;
    }
    const results = await Promise.all(batch.map((candidate) => readIndexedFile({
      absolutePath: candidate.path,
      outputPath: outputPath(base, candidate.path),
      bytes: new ByteBudget("scan file bytes", candidate.size),
      evidence: new CounterBudget("scan file evidence", candidate.evidenceCapacity),
      deadline,
      maxFileBytes: limits.maxFileBytes
    }, {
      beforeStat: async (path) => runBeforeRepositoryStatHook(options, path, budget),
      beforeOpen: async (path) => runBeforeRepositoryContentHook(options, path, budget)
    })));
    let deadlineReached = false;
    for (const result of results) {
      if (!result.file) {
        if (result.omission) {
          state.omissions.push(result.omission);
          if (result.omission.reason === "deadline") deadlineReached = true;
        }
        continue;
      }
      files.push(result.file);
      evidence.push(...result.evidence);
    }
    if (deadlineReached) {
      if (start < prepared.length) recordDiscoveryOmission(state, outputPath(base, prepared[start].path), "deadline");
      break;
    }
  }
  return {
    files: files.sort((left, right) => left.path.localeCompare(right.path, "en-US")),
    evidence: evidence.sort((left, right) => left.path.localeCompare(right.path, "en-US") || left.line - right.line),
    omissions: state.omissions.sort((left, right) => left.path.localeCompare(right.path, "en-US") || left.reason.localeCompare(right.reason, "en-US"))
  };
}
async function index(scope, options, budget) {
  return indexScopes(scope, [scope], options, budget);
}
function repositoryPath2(path) {
  return path.replaceAll("\\", "/");
}
function pathKey(path) {
  return repositoryPath2(path).toLocaleLowerCase("en-US");
}
function differences(current, previous, budget) {
  const previousFiles = typeof previous === "object" && previous !== null && "files" in previous ? previous.files : previous;
  const prior = typeof previousFiles === "object" && previousFiles !== null && !Array.isArray(previousFiles) ? previousFiles : {};
  if (Object.keys(prior).length > (budget?.maxFiles ?? resolveKeeperLimits().scan.maxFiles)) {
    throw new Error(`Previous snapshot files exceed the file limit of ${budget?.maxFiles ?? resolveKeeperLimits().scan.maxFiles}`);
  }
  const currentByKey = new Map(Object.entries(current).map(([path, fingerprint2]) => [pathKey(path), { path, fingerprint: fingerprint2 }]));
  const priorByKey = new Map(Object.entries(prior).map(([path, fingerprint2]) => [pathKey(path), { path, fingerprint: fingerprint2 }]));
  const changed = [...currentByKey.entries()].flatMap(([key, value]) => {
    const earlier = priorByKey.get(key);
    return earlier && earlier.fingerprint !== value.fingerprint ? [value.path] : [];
  }).sort();
  const fresh = [...currentByKey.entries()].flatMap(([key, value]) => priorByKey.has(key) ? [] : [value.path]).sort();
  const deleted = [...priorByKey.entries()].flatMap(([key, value]) => currentByKey.has(key) ? [] : [value.path]).sort();
  return { changed, new: fresh, deleted };
}
async function finalizeScan(scope, indexed, chunks, omissions, scopePaths, previousSnapshot, options, persistIndex = true, budget = createScopeOperationBudget(options)) {
  const fingerprints = Object.fromEntries(indexed.map((file) => [file.path, file.fingerprint]));
  const changeSet = differences(fingerprints, previousSnapshot, budget);
  const snapshot2 = { ...scope, files: fingerprints, ...changeSet };
  const repository = await gitMetadata(scope.repositoryRoot, options, budget);
  const scopeKey = scopePathsKey(scopePaths);
  const cursorScopeKey = scopeCursorKey(scope.root, scopeKey);
  const modules = scopeCandidateModulesForFiles(indexed);
  const snapshotId = scopeSnapshotIdForContent({
    scopePaths,
    files: indexed,
    evidence: chunks,
    candidateModules: modules,
    omissions
  });
  const now = options.now?.() ?? Date.now();
  let snapshotExpiresAt = now + cursorMaximumLifetimeMs;
  if (persistIndex) {
    const persisted = await persistScopeIndex({
      options,
      projectRoot: scope.root,
      scopePaths,
      snapshotId,
      files: indexed,
      evidence: chunks,
      candidateModules: modules,
      omissions
    });
    snapshotExpiresAt = persisted.expiresAt;
  }
  return {
    ...scope,
    ...repository ? { repository } : {},
    indexedFiles: indexed,
    files: indexed.map((file) => file.path),
    fingerprints,
    chunks,
    candidateModules: modules,
    omissions,
    snapshot: snapshot2,
    ...changeSet,
    omitted: omissions.length,
    snapshotId,
    snapshotExpiresAt,
    scopePaths,
    scopeKey,
    cursorScopeKey
  };
}
async function scan(input, options = {}, persistIndex = true, budget = createScopeOperationBudget(options)) {
  const scope = await resolveScope(input, options, budget);
  const indexedResult = await index(scope, options, budget);
  return finalizeScan(
    scope,
    indexedResult.files,
    indexedResult.evidence,
    indexedResult.omissions,
    [input.root ? repositoryPath2(input.path ?? ".") : "."],
    input.previousSnapshot,
    options,
    persistIndex,
    budget
  );
}
async function snapshotForFingerprint(input, options = {}, budget = createScopeOperationBudget(options)) {
  const scope = await resolveScope(input, options, budget);
  const indexedResult = await index(scope, options, budget);
  return (await finalizeScan(
    scope,
    indexedResult.files,
    indexedResult.evidence,
    indexedResult.omissions,
    [input.path ?? "."],
    void 0,
    options,
    false,
    budget
  )).snapshot;
}
async function resolveSelectedScope(base, path, budget) {
  budget.deadline.check();
  const lexicalTarget = resolve5(base.root, path);
  if (!isInside(base.root, lexicalTarget)) throw new Error(`Selected scope path escapes the supplied root: ${path}`);
  try {
    await lstat5(lexicalTarget);
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
  const target = await canonical(lexicalTarget);
  budget.deadline.check();
  if (!isInside(base.root, target)) throw new Error(`Selected scope path resolves outside the supplied root: ${path}`);
  return { ...base, target };
}
async function scanSelectedPaths(root, requestedPaths, previousSnapshot, options, persistIndex = true, budget = createScopeOperationBudget(options)) {
  budget.deadline.check();
  if (requestedPaths.length > budget.maxFiles) {
    throw new Error(`Selected scope paths exceed the file limit of ${budget.maxFiles}`);
  }
  const paths = [...new Set(requestedPaths.map(repositoryPath2))].sort((left, right) => left.localeCompare(right));
  if (paths.length === 0 || paths.includes(".")) return scan({ root, previousSnapshot }, options, persistIndex, budget);
  for (const path of paths) {
    if (!safeRepositoryPath(path)) throw new Error(`Selected scope path is not a safe repository path: ${path}`);
  }
  const base = await resolveScope({ root }, options, budget);
  const selectedScopes = [];
  for (let start = 0; start < paths.length; start += 8) {
    budget.deadline.check();
    const batch = await Promise.all(paths.slice(start, start + 8).map((path) => resolveSelectedScope(base, path, budget)));
    selectedScopes.push(...batch.filter((scope) => Boolean(scope)));
  }
  const indexed = await indexScopes(base, selectedScopes, options, budget);
  return finalizeScan(
    base,
    indexed.files,
    indexed.evidence,
    indexed.omissions,
    paths,
    previousSnapshot,
    options,
    persistIndex,
    budget
  );
}
function scopeInput(input) {
  return {
    path: typeof input.path === "string" ? input.path : void 0,
    root: typeof input.root === "string" ? input.root : void 0
  };
}
function asArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : typeof value === "string" ? [value] : [];
}
function boundedInteger(value, fallback, maximum, name2) {
  if (value === void 0) return fallback;
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > maximum) {
    throw new Error(`${name2} must be an integer between 1 and ${maximum}`);
  }
  return Number(value);
}
async function manifestFor(scope, options, budget) {
  const packRoot = await safePackRoot(scope);
  if (!packRoot) return void 0;
  for (const name2 of ["manifest.json", "project-design-manifest.json"]) {
    const candidate = await safeManifestFile(packRoot, name2);
    if (candidate.kind === "missing") continue;
    if (candidate.kind === "unsafe") return void 0;
    const bytes = await readBoundedRepositoryMetadata(candidate.path, packRoot.canonical, options, budget);
    if (!bytes) return void 0;
    try {
      const parsed = JSON.parse(decodeFatalUtf8(bytes));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return void 0;
      const raw = parsed;
      const limits = resolveKeeperLimits(options.limits).pack;
      if (Array.isArray(raw.documents) && raw.documents.length > limits.maxDocuments) {
        throw new Error(`Pack documents exceed the limit of ${limits.maxDocuments}`);
      }
      const records = boundedPackRecords(raw.records, options, budget);
      return {
        records,
        documents: Array.isArray(raw.documents) ? raw.documents.filter((item) => typeof item === "object" && item !== null) : [],
        sourceRevision: raw.sourceRevision,
        scope: raw.scope,
        schemaVersion: raw.schemaVersion
      };
    } catch (error) {
      if (/^Pack /u.test(String(error.message))) throw error;
      return void 0;
    }
  }
  return void 0;
}
function boundedPackRecords(value, options, budget) {
  if (!Array.isArray(value)) return [];
  const limits = resolveKeeperLimits(options.limits).pack;
  if (value.length > limits.maxRecords) throw new Error(`Pack records exceed the limit of ${limits.maxRecords}`);
  const records = [];
  for (const item of value) {
    budget.deadline.check();
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item;
    if (Array.isArray(record.evidence) && record.evidence.length > limits.maxEvidencePerRecord) {
      throw new Error(`Pack record evidence exceeds the limit of ${limits.maxEvidencePerRecord}`);
    }
    for (const evidence of Array.isArray(record.evidence) ? record.evidence : []) {
      if (!evidence || typeof evidence !== "object" || Array.isArray(evidence) || !("endLine" in evidence)) continue;
      const typed = evidence;
      const startLine = Number(typed.startLine);
      const endLine = Number(typed.endLine);
      if (!Number.isSafeInteger(startLine) || startLine < 1 || !Number.isSafeInteger(endLine) || endLine < startLine) {
        throw new Error("Pack record evidence range has an invalid endLine");
      }
    }
    if (Array.isArray(record.impact) && record.impact.length > limits.maxImpactPerRecord) {
      throw new Error(`Pack record impact exceeds the limit of ${limits.maxImpactPerRecord}`);
    }
    for (const field of ["paths", "modules"]) {
      if (Array.isArray(record[field]) && record[field].length > limits.maxEvidencePerRecord) {
        throw new Error(`Pack record ${field} exceed the limit of ${limits.maxEvidencePerRecord}`);
      }
    }
    records.push(record);
  }
  return records;
}
function textOf(record) {
  const fields = [
    "id",
    "domain",
    "scope",
    "statement",
    "evidence",
    "impact",
    "status",
    "strength",
    "approval",
    "confidence",
    "assertedConfidence",
    "supersedes",
    "supersededBy",
    "module",
    "modules",
    "path",
    "paths",
    "summary"
  ];
  return fields.flatMap((field) => {
    const value = record[field];
    return asArray(value).length > 0 ? asArray(value) : value && typeof value === "object" ? [JSON.stringify(value)] : [];
  }).join(" ").toLocaleLowerCase();
}
function evidenceReference(value) {
  const match = /^(.*):([0-9]+)$/u.exec(value);
  if (!match) return void 0;
  const line = Number(match[2]);
  return Number.isSafeInteger(line) && line > 0 ? { path: match[1], line } : void 0;
}
function recordEvidence(record) {
  if (!Array.isArray(record.evidence)) return [];
  return record.evidence.flatMap((value) => {
    if (typeof value === "string") {
      const parsed = evidenceReference(value);
      return parsed ? [{ ...parsed, reference: value }] : [];
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const evidence = value;
    const line = Number(evidence.startLine);
    const endLine = Number(evidence.endLine ?? evidence.startLine);
    if (evidence.endLine !== void 0 && (!Number.isSafeInteger(endLine) || endLine < line)) return [];
    return typeof evidence.path === "string" && Number.isSafeInteger(line) && line > 0 ? [{
      path: evidence.path,
      line,
      ...Number.isSafeInteger(endLine) && endLine >= line ? { endLine } : {},
      reference: `${evidence.path}:${String(evidence.startLine)}`
    }] : [];
  });
}
function manifestEvidencePaths(manifest2, budget) {
  const paths = new Set(Object.keys(revisionFiles(manifest2.sourceRevision, budget.maxFiles, budget.deadline)));
  if (paths.size > budget.maxFiles) throw new Error(`Manifest evidence paths exceed the file limit of ${budget.maxFiles}`);
  for (const record of manifest2.records) {
    budget.deadline.check();
    for (const evidence of recordEvidence(record)) {
      paths.add(evidence.path);
      if (paths.size > budget.maxFiles) {
        throw new Error(`Manifest evidence paths exceed the file limit of ${budget.maxFiles}`);
      }
    }
  }
  return [...paths];
}
function typedRecordEvidence(record) {
  if (!Array.isArray(record.evidence)) return [];
  return record.evidence.flatMap((value, evidenceIndex) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const evidence = value;
    const startLine = Number(evidence.startLine);
    const endLine = Number(evidence.endLine ?? evidence.startLine);
    return typeof evidence.path === "string" && Number.isSafeInteger(startLine) && startLine > 0 && Number.isSafeInteger(endLine) && endLine >= startLine && typeof evidence.excerptHash === "string" ? [{ evidenceIndex, path: evidence.path, startLine, endLine, excerptHash: evidence.excerptHash }] : [];
  });
}
function revisionFiles(value, maximumEntries = resolveKeeperLimits().scan.maxFiles, deadline) {
  const candidate = typeof value === "object" && value !== null && "files" in value ? value.files : value;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return {};
  const entries = Object.entries(candidate);
  if (entries.length > maximumEntries) throw new Error(`Source revision files exceed the file limit of ${maximumEntries}`);
  const result = {};
  for (const [path, fingerprint2] of entries) {
    deadline?.check();
    if (typeof fingerprint2 === "string" && safeRepositoryPath(path)) result[path] = fingerprint2;
  }
  return result;
}
function declaredScopePaths(pack, previous, budget) {
  const scope = pack && typeof pack.scope === "object" && pack.scope !== null ? pack.scope : void 0;
  if (Array.isArray(scope?.paths) && scope.paths.length > budget.maxFiles) {
    throw new Error(`Selected scope paths exceed the file limit of ${budget.maxFiles}`);
  }
  const paths = asArray(scope?.paths).filter((path) => safeRepositoryPath(path));
  const revisionPaths = Object.keys(revisionFiles(previous, budget.maxFiles, budget.deadline));
  if (paths.length + revisionPaths.length > budget.maxFiles * 2) {
    throw new Error(`Selected scope path work exceeds the file limit of ${budget.maxFiles}`);
  }
  const selected2 = [.../* @__PURE__ */ new Set([...paths, ...revisionPaths])];
  if (selected2.length > budget.maxFiles) throw new Error(`Selected scope paths exceed the file limit of ${budget.maxFiles}`);
  return selected2;
}
function freshnessFor(result, previous, records, now, schemaVersion) {
  const prior = revisionFiles(previous);
  const hasRevision = Object.keys(prior).length > 0;
  const changed = new Set(result.changed.map(pathKey));
  const deleted = new Set(result.deleted.map(pathKey));
  const current = new Set(Object.keys(result.fingerprints).map(pathKey));
  const revisionPaths = new Set(Object.keys(prior).map(pathKey));
  const evidenceIndex = new Map(result.chunks.map((chunk) => [`${pathKey(chunk.path)}:${chunk.line}`, chunk]));
  const recordState = records.map((record) => {
    const reasons = /* @__PURE__ */ new Set();
    let hasUnrevisionedEvidence = false;
    const parsedEvidence = recordEvidence(record);
    const declaredEvidenceCount = Array.isArray(record.evidence) ? record.evidence.length : 0;
    if (parsedEvidence.length !== declaredEvidenceCount) reasons.add("evidence-reference-invalid");
    for (const parsed of parsedEvidence) {
      if (!parsed) {
        reasons.add("evidence-reference-invalid");
        continue;
      }
      const key = pathKey(parsed.path);
      if (hasRevision && !revisionPaths.has(key)) {
        reasons.add("evidence-source-unrevisioned");
        hasUnrevisionedEvidence = true;
      } else if (deleted.has(key) || !current.has(key)) reasons.add("evidence-source-deleted");
      else if (changed.has(key)) reasons.add("evidence-source-modified");
      else if (!evidenceIndex.has(`${key}:${parsed.line}`)) reasons.add("evidence-line-invalid");
    }
    const verification = !hasRevision || hasUnrevisionedEvidence ? "unverified" : reasons.size > 0 ? "historical" : "verified";
    const declaredConfidence = record.assertedConfidence ?? record.confidence;
    let confidence = typeof declaredConfidence === "string" && ["high", "medium", "low"].includes(declaredConfidence) ? declaredConfidence : "unknown";
    if (schemaVersion === "3.0" && verification === "verified" && typeof record.id === "string" && typeof record.assertedConfidence === "string" && Array.isArray(record.evidence)) {
      const assessment = assessRecord({
        id: record.id,
        kind: typeof record.kind === "string" ? record.kind : void 0,
        approval: typeof record.approval === "string" ? record.approval : void 0,
        assertedConfidence: record.assertedConfidence,
        evidence: record.evidence
      });
      confidence = assessment.effectiveConfidence;
      for (const reason of assessment.reasons) reasons.add(reason);
    }
    return {
      record,
      verification,
      effectiveConfidence: verification === "historical" ? "low" : verification === "unverified" ? "unknown" : confidence,
      reasons: [...reasons]
    };
  });
  const invalidatedRecordIds = recordState.flatMap((state) => state.verification === "historical" && typeof state.record.id === "string" ? [state.record.id] : []);
  const stale = result.changed.length > 0 || result.new.length > 0 || result.deleted.length > 0 || invalidatedRecordIds.length > 0;
  return {
    freshness: {
      status: !hasRevision ? "unknown" : stale ? "stale" : "fresh",
      checkedAt: new Date(now()).toISOString(),
      comparedFiles: Object.keys(prior).length,
      changedFiles: result.changed,
      deletedFiles: result.deleted,
      invalidatedRecordIds
    },
    records: recordState
  };
}
function pathApplies(candidate, requested) {
  const candidateKey = pathKey(candidate);
  const requestedKey = pathKey(requested).replace(/\/$/u, "");
  return candidateKey === requestedKey || candidateKey.startsWith(`${requestedKey}/`) || requestedKey.startsWith(`${candidateKey}/`);
}
function pathSelector(paths, budget, options) {
  const root = { terminal: false, children: /* @__PURE__ */ new Map() };
  for (const path of paths) {
    consumeSelectorWork(budget, options, "record-filter");
    let node = root;
    for (const segment of pathKey(path).replace(/\/$/u, "").split("/")) {
      consumeSelectorWork(budget, options, "record-filter");
      let child = node.children.get(segment);
      if (!child) {
        child = { terminal: false, children: /* @__PURE__ */ new Map() };
        node.children.set(segment, child);
      }
      node = child;
    }
    node.terminal = true;
  }
  return root;
}
function pathSelectorMatches(selector, candidate, budget, options) {
  let node = selector;
  for (const segment of pathKey(candidate).split("/")) {
    consumeSelectorWork(budget, options, "record-filter");
    if (node.terminal) return true;
    const child = node.children.get(segment);
    if (!child) return false;
    node = child;
  }
  return node.terminal || node.children.size > 0;
}
function recordPaths(record) {
  return [
    ...recordEvidence(record).map((evidence) => evidence.path),
    ...asArray(record.paths ?? record.path)
  ];
}
function recordModules(record) {
  const explicit = asArray(record.modules ?? record.module);
  const scope = typeof record.scope === "string" ? record.scope : "";
  return [...explicit, ...scope.split(/[^A-Za-z0-9_-]+/u).filter(Boolean)];
}
function chunkKey(path, line) {
  return `${pathKey(path)}:${line}`;
}
function chunkLookup(chunks) {
  return new Map(chunks.map((chunk) => [chunkKey(chunk.path, chunk.line), chunk]));
}
function referencedChunk(chunks, reference) {
  return chunks.get(chunkKey(reference.path, reference.line));
}
function queryMatchesRecord(record, queryTerm, chunks, budget, options) {
  if (!queryTerm) return true;
  consumeSelectorWork(budget, options, "record-filter");
  if (textOf(record).includes(queryTerm)) return true;
  budget.deadline.check();
  for (const evidence of recordEvidence(record)) {
    consumeSelectorWork(budget, options, "record-filter");
    if (referencedChunk(chunks, evidence)?.text.toLocaleLowerCase().includes(queryTerm)) return true;
  }
  return false;
}
function matchingRecords(manifest2, query, paths, modules, chunks, options, budget) {
  if (!manifest2) return [];
  const queryTerm = query.toLocaleLowerCase();
  const pathTerms = paths.filter(Boolean);
  const selectedPaths = pathTerms.length > 0 ? pathSelector(pathTerms, budget, options) : void 0;
  const moduleTerms = /* @__PURE__ */ new Set();
  for (const term of modules.filter(Boolean)) {
    consumeSelectorWork(budget, options, "record-filter");
    moduleTerms.add(term.toLocaleLowerCase("en-US"));
  }
  const indexedChunks = chunkLookup(chunks);
  if (!queryTerm && !selectedPaths && moduleTerms.size === 0) return [];
  const matches = [];
  for (const record of manifest2.records) {
    consumeSelectorWork(budget, options, "record-filter");
    let pathsMatch = !selectedPaths;
    if (selectedPaths) {
      for (const path of recordPaths(record)) {
        if (pathSelectorMatches(selectedPaths, path, budget, options)) {
          pathsMatch = true;
          break;
        }
      }
    }
    if (!pathsMatch) continue;
    let modulesMatch = moduleTerms.size === 0;
    if (!modulesMatch) {
      for (const module of recordModules(record)) {
        consumeSelectorWork(budget, options, "record-filter");
        if (moduleTerms.has(module.toLocaleLowerCase("en-US"))) {
          modulesMatch = true;
          break;
        }
      }
    }
    if (modulesMatch && queryMatchesRecord(record, queryTerm, indexedChunks, budget, options)) matches.push(record);
  }
  return matches;
}
function filteredRecords(records, domain, status, options, budget) {
  const domains = new Set(asArray(domain).map((value) => value.toLocaleLowerCase("en-US")));
  const statuses = new Set(asArray(status).map((value) => value.toLocaleLowerCase("en-US")));
  const matches = [];
  for (const record of records) {
    consumeSelectorWork(budget, options, "record-filter");
    const recordDomains = asArray(record.domain ?? record.domains);
    const recordStatuses = asArray(record.status ?? record.statuses);
    const domainMatches = domains.size === 0 || recordDomains.some((value) => domains.has(value.toLocaleLowerCase("en-US")));
    const statusMatches = statuses.size === 0 || recordStatuses.some((value) => statuses.has(value.toLocaleLowerCase("en-US")));
    if (domainMatches && statusMatches) matches.push(record);
  }
  return matches;
}
function recordSummary(record) {
  const fields = [
    "id",
    "domain",
    "scope",
    "statement",
    "evidence",
    "impact",
    "status",
    "strength",
    "approval",
    "confidence",
    "assertedConfidence",
    "kind",
    "ownerDocument",
    "lifecycle",
    "supersedes",
    "supersededBy"
  ];
  return Object.fromEntries(fields.flatMap((field) => field in record ? [[field, record[field]]] : []));
}
function documentSummary(document) {
  return Object.fromEntries(["id", "path"].flatMap((field) => field in document ? [[field, document[field]]] : []));
}
function sameCanonicalAbsolutePath(left, right) {
  const leftPath = resolve5(left);
  const rightPath = resolve5(right);
  return process.platform === "win32" ? leftPath.toLocaleLowerCase("en-US") === rightPath.toLocaleLowerCase("en-US") : leftPath === rightPath;
}
function sameRepositoryFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.gid === right.gid && left.mode === right.mode && left.nlink === right.nlink && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs && left.isFile() && right.isFile() && !left.isSymbolicLink() && !right.isSymbolicLink();
}
async function readBoundedRepositoryMetadata(lexicalPath, allowedRoot, options, budget) {
  budget.deadline.check();
  let initial;
  let canonicalPath;
  try {
    [initial, canonicalPath] = await Promise.all([
      lstat5(lexicalPath, { bigint: true }),
      realpath4(lexicalPath)
    ]);
  } catch {
    budget.deadline.check();
    return void 0;
  }
  if (initial.isSymbolicLink() || !initial.isFile() || !sameCanonicalAbsolutePath(canonicalPath, lexicalPath) || !isInside(allowedRoot, canonicalPath)) return void 0;
  const size = Number(initial.size);
  if (!Number.isSafeInteger(size) || size < 0) throw new Error("Scope metadata file has an invalid byte length");
  budget.repositoryFiles.consume();
  if (size > budget.maxFileBytes) {
    throw new Error(`Scope metadata file bytes exceed the per-file limit of ${budget.maxFileBytes}`);
  }
  budget.repositoryBytes.consume(size);
  await runBeforeRepositoryContentHook(options, lexicalPath, budget);
  let handle;
  try {
    handle = await open5(lexicalPath, "r");
  } catch {
    budget.deadline.check();
    return void 0;
  }
  try {
    const opened = await handle.stat({ bigint: true });
    if (!sameRepositoryFileIdentity(initial, opened) || Number(opened.size) !== size) return void 0;
    const bytes = Buffer.allocUnsafe(size);
    let offset = 0;
    while (offset < size) {
      budget.deadline.check();
      const chunkSize = Math.min(64 * 1024, size - offset);
      const read = await handle.read(bytes, offset, chunkSize, offset);
      if (read.bytesRead <= 0) return void 0;
      offset += read.bytesRead;
    }
    budget.deadline.check();
    let finalPath;
    let finalHandle;
    let finalCanonical;
    try {
      [finalPath, finalHandle, finalCanonical] = await Promise.all([
        lstat5(lexicalPath, { bigint: true }),
        handle.stat({ bigint: true }),
        realpath4(lexicalPath)
      ]);
    } catch {
      return void 0;
    }
    if (!sameRepositoryFileIdentity(initial, finalPath) || !sameRepositoryFileIdentity(initial, finalHandle) || Number(finalPath.size) !== size || Number(finalHandle.size) !== size || !sameCanonicalAbsolutePath(finalCanonical, lexicalPath) || !isInside(allowedRoot, finalCanonical)) return void 0;
    budget.deadline.check();
    return bytes;
  } finally {
    await handle.close();
  }
}
function decodeFatalUtf8(bytes) {
  return new TextDecoder3("utf-8", { fatal: true }).decode(bytes);
}
async function safePackRoot(scope) {
  const lexicalPackRoot = resolve5(scope.root, "docs", "project-design");
  try {
    const [actualRepositoryRoot, actualPackRoot] = await Promise.all([
      realpath4(scope.repositoryRoot ?? scope.root),
      realpath4(lexicalPackRoot)
    ]);
    if (!sameCanonicalAbsolutePath(actualPackRoot, lexicalPackRoot) || !isInside(actualRepositoryRoot, actualPackRoot) || !(await stat(actualPackRoot)).isDirectory()) return void 0;
    return { lexical: lexicalPackRoot, canonical: actualPackRoot };
  } catch {
    return void 0;
  }
}
async function safeManifestFile(packRoot, name2) {
  const lexicalPath = resolve5(packRoot.lexical, name2);
  if (!isInside(packRoot.lexical, lexicalPath)) return { kind: "unsafe" };
  let metadata;
  try {
    metadata = await lstat5(lexicalPath);
  } catch (error) {
    return error.code === "ENOENT" ? { kind: "missing" } : { kind: "unsafe" };
  }
  if (metadata.isSymbolicLink() || !metadata.isFile()) return { kind: "unsafe" };
  try {
    const [currentPackRoot, actualPath] = await Promise.all([realpath4(packRoot.lexical), realpath4(lexicalPath)]);
    if (!sameCanonicalAbsolutePath(currentPackRoot, packRoot.canonical) || !isInside(packRoot.canonical, actualPath) || !sameCanonicalAbsolutePath(actualPath, lexicalPath)) return { kind: "unsafe" };
    return { kind: "regular", path: actualPath };
  } catch {
    return { kind: "unsafe" };
  }
}
async function safeDocumentRoute(root, packRoot, document, options, budget) {
  if (typeof document.path !== "string" || !safeRepositoryPath(document.path) || !document.path.startsWith("docs/project-design/") || !document.path.endsWith(".md")) return void 0;
  const lexicalPath = resolve5(root, document.path);
  if (!isInside(packRoot.lexical, lexicalPath)) return void 0;
  const bytes = await readBoundedRepositoryMetadata(lexicalPath, packRoot.canonical, options, budget);
  if (!bytes) return void 0;
  try {
    const markdown = decodeFatalUtf8(bytes);
    const expression = /<!-- project-design-keeper:managed record-id="([A-Za-z0-9][A-Za-z0-9._:-]*)" content-hash="(sha256:[a-f0-9]{64})" -->([\s\S]*?)<!-- \/project-design-keeper:managed -->/gu;
    const recordIds = new Set([...markdown.matchAll(expression)].flatMap(
      (match) => sha256(Buffer.from(match[3], "utf8")) === match[2] ? [match[1]] : []
    ));
    return { document, recordIds };
  } catch {
    return void 0;
  }
}
async function documentsForContext(scope, manifest2, related, query, paths, options, budget) {
  if (!manifest2) return [];
  if (manifest2.documents.length > budget.maxFiles) {
    throw new Error(`Pack documents exceed the file limit of ${budget.maxFiles}`);
  }
  const packRoot = await safePackRoot(scope);
  if (!packRoot) return [];
  const relatedIds = new Set(related.flatMap((record) => typeof record.id === "string" ? [record.id] : []));
  const routed = [];
  for (let start = 0; start < manifest2.documents.length; start += 8) {
    budget.deadline.check();
    const batch = await Promise.all(manifest2.documents.slice(start, start + 8).map((document) => safeDocumentRoute(scope.root, packRoot, document, options, budget)));
    routed.push(...batch.filter((route) => Boolean(route)));
  }
  const queryTerm = query.toLocaleLowerCase();
  return routed.filter(
    ({ document, recordIds }) => [...recordIds].some((id) => relatedIds.has(id)) || queryTerm.length > 0 && textOf(document).includes(queryTerm) || paths.some((path) => typeof document.path === "string" && pathApplies(document.path, path))
  ).map(({ document }) => documentSummary(document));
}
function assertContinuationCursorCurrent(cursor, now) {
  if (Number.isSafeInteger(now) && now >= cursor.expiresAt) {
    throw new ScopeSnapshotRestartError("expired");
  }
  assertCursorCurrent(cursor, now);
}
function evidenceForContext(chunks, query, requestedPaths, requestedModules, related, modules, limit, options, budget) {
  const indexedChunks = chunkLookup(chunks);
  const seen = /* @__PURE__ */ new Set();
  const selected2 = [];
  let sawReference = false;
  for (const record of related) {
    for (const reference of recordEvidence(record)) {
      sawReference = true;
      consumeSelectorWork(budget, options, "reference-index");
      const key = chunkKey(reference.path, reference.line);
      if (seen.has(key)) continue;
      seen.add(key);
      const chunk = referencedChunk(indexedChunks, reference);
      if (chunk) selected2.push(chunk);
      if (selected2.length >= limit) return selected2;
    }
  }
  if (sawReference) return selected2;
  const requestedModuleSet = new Set(requestedModules.map((requested) => requested.toLocaleLowerCase("en-US")));
  const modulePaths = [];
  for (const module of modules) {
    consumeSelectorWork(budget, options, "record-filter");
    const id = module.id.toLocaleLowerCase("en-US");
    let applies = requestedModuleSet.has(id);
    for (let separator = id.indexOf("."); !applies && separator >= 0; separator = id.indexOf(".", separator + 1)) {
      consumeSelectorWork(budget, options, "record-filter");
      applies = requestedModuleSet.has(id.slice(separator + 1));
    }
    if (applies) modulePaths.push(...module.paths);
  }
  const allowed = [...requestedPaths, ...modulePaths];
  const selectedPaths = allowed.length > 0 ? pathSelector(allowed, budget, options) : void 0;
  const queryTerm = query.toLocaleLowerCase();
  const filtered = [];
  for (const chunk of chunks) {
    consumeSelectorWork(budget, options, "chunk-filter");
    if (queryTerm && !chunk.text.toLocaleLowerCase().includes(queryTerm)) continue;
    if (!selectedPaths && !queryTerm) continue;
    if (selectedPaths && !pathSelectorMatches(selectedPaths, chunk.path, budget, options)) continue;
    filtered.push(chunk);
  }
  return filtered.sort((left, right) => {
    const score = (value) => queryTerm ? value.toLocaleLowerCase().split(queryTerm).length - 1 : 0;
    return score(right.text) - score(left.text) || left.path.localeCompare(right.path) || left.line - right.line;
  }).slice(0, limit);
}
async function continuationScopeBinding(input) {
  if (input.root) {
    const root2 = await canonical(input.root);
    const requested = repositoryPath2(input.path ?? ".");
    if (isAbsolute3(requested)) throw new Error("An absolute path is not allowed when root is supplied");
    const lexicalTarget = resolve5(root2, requested);
    if (!isInside(root2, lexicalTarget)) throw new Error("Scope path escapes the supplied root");
    const scopePaths2 = [requested];
    return { root: root2, scopePaths: scopePaths2, cursorScopeKey: scopeCursorKey(root2, scopePathsKey(scopePaths2)) };
  }
  if (!input.path) throw new Error("A scope path or root is required");
  const root = await canonical(input.path);
  const scopePaths = ["."];
  return { root, scopePaths, cursorScopeKey: scopeCursorKey(root, scopePathsKey(scopePaths)) };
}
function explicitDriftScopePaths(input, budget) {
  const pack = typeof input.pack === "object" && input.pack !== null ? input.pack : void 0;
  const hasExplicitSelection = input.sourceRevision !== void 0 || pack?.sourceRevision !== void 0 || pack?.scope !== void 0;
  if (!hasExplicitSelection) return void 0;
  const previous = input.previousSnapshot ?? input.sourceRevision ?? pack?.sourceRevision;
  const selected2 = declaredScopePaths(pack, previous, budget);
  if (selected2.length === 0) return void 0;
  const normalized3 = [...new Set(selected2.map(repositoryPath2))].sort((left, right) => left.localeCompare(right));
  return normalized3.includes(".") ? ["."] : normalized3;
}
function driftRequestScopeSelection(input, budget) {
  const explicit = explicitDriftScopePaths(input, budget);
  if (explicit) return { mode: "declared", scopePaths: explicit };
  const source = scopeInput(input);
  if (source.root) {
    return {
      mode: source.path === void 0 ? "implicit-root" : "explicit-path",
      scopePaths: [repositoryPath2(source.path ?? ".")]
    };
  }
  return { mode: "path-root", scopePaths: ["."] };
}
function driftRequestCursorScopeKey(root, selection) {
  return scopeCursorKey(root, scopePathsKey([`@drift-request:${selection.mode}`, ...selection.scopePaths]));
}
async function driftContinuationScopeBinding(input, options) {
  const binding = await continuationScopeBinding(scopeInput(input));
  const selection = driftRequestScopeSelection(input, createScopeOperationBudget(options));
  return {
    ...binding,
    scopePaths: selection.scopePaths,
    cursorScopeKey: driftRequestCursorScopeKey(binding.root, selection)
  };
}
var driftCursorSnapshotPattern = /^(sha256:[a-f0-9]{64})@([a-f0-9]{64})$/u;
function driftCursorSnapshotBinding(snapshotId, storageScopePaths) {
  return `${snapshotId}@${scopePathsKey([...storageScopePaths])}`;
}
function driftCursorStorageBinding(root, cursorSnapshotId, legacyCursorScopeKey) {
  const match = driftCursorSnapshotPattern.exec(cursorSnapshotId);
  return match ? { snapshotId: match[1], cursorScopeKey: scopeCursorKey(root, match[2]) } : { snapshotId: cursorSnapshotId, cursorScopeKey: legacyCursorScopeKey };
}
function publicScopePaths(input, root, internalScopePaths) {
  return input.root === void 0 && input.path !== void 0 ? [root] : [...internalScopePaths];
}
async function scanScope(input, options = {}) {
  const view = scanView(input.view);
  const cursor = typeof input.cursor === "string" ? input.cursor : input.cursor === void 0 ? void 0 : (() => {
    throw new Error("Scan cursor must be a string");
  })();
  if (cursor !== void 0) {
    if (view === "summary") throw new Error("A scan cursor requires files or evidence view");
    const binding = await continuationScopeBinding(input);
    const now2 = options.now?.() ?? Date.now();
    const codec2 = await createCursorCodec(options, binding.root);
    const decoded = codec2.decode(cursor, parseScopeCursorPayload);
    assertContinuationCursorCurrent(decoded, now2);
    if (decoded.scopeKey !== binding.cursorScopeKey || decoded.view !== view) {
      throw new Error("Scan cursor does not belong to this root, scope, or view");
    }
    const loaded = await loadScopeIndex({
      options,
      projectRoot: binding.root,
      scopeKey: decoded.scopeKey,
      snapshotId: decoded.snapshotId,
      now: now2
    });
    if (decoded.expiresAt !== loaded.expiresAt) {
      throw new ScopeSnapshotRestartError("corrupt");
    }
    const base2 = {
      schemaVersion: 2,
      snapshotId: loaded.snapshotId,
      scope: { root: binding.root, paths: publicScopePaths(input, binding.root, loaded.scopePaths) },
      totals: {
        files: loaded.totals.files,
        evidence: loaded.totals.evidence,
        omitted: loaded.totals.omitted
      },
      candidateModules: loaded.candidateModules.slice(0, 200)
    };
    const limit2 = scanLimit(input.limit);
    const byteBudget2 = Math.max(16 * 1024, 1024 * 1024 - Buffer.byteLength(JSON.stringify(base2), "utf8") - 4096);
    if (view === "files") {
      const page3 = await pageItems({
        items: loaded.files,
        limit: limit2,
        codec: codec2,
        now: now2,
        expiresAt: loaded.expiresAt,
        cursor,
        snapshotId: loaded.snapshotId,
        scopeKey: loaded.cursorScopeKey,
        view,
        byteBudget: byteBudget2
      });
      return { ...base2, ...page3 };
    }
    const page2 = await pageItems({
      items: loaded.evidence,
      limit: limit2,
      codec: codec2,
      now: now2,
      expiresAt: loaded.expiresAt,
      cursor,
      snapshotId: loaded.snapshotId,
      scopeKey: loaded.cursorScopeKey,
      view,
      byteBudget: byteBudget2
    });
    return { ...base2, ...page2 };
  }
  const result = await scan(input, options);
  const base = {
    schemaVersion: 2,
    snapshotId: result.snapshotId,
    scope: { root: result.root, paths: publicScopePaths(input, result.root, result.scopePaths) },
    ...result.repository ? { repository: result.repository } : {},
    totals: { files: result.indexedFiles.length, evidence: result.chunks.length, omitted: result.omitted },
    candidateModules: result.candidateModules.slice(0, 200)
  };
  if (view === "summary") {
    return base;
  }
  const limit = scanLimit(input.limit);
  const now = options.now?.() ?? Date.now();
  const codec = await createCursorCodec(options, result.root);
  const expiresAt = result.snapshotExpiresAt;
  if (view === "files") {
    const files = result.indexedFiles;
    const byteBudget2 = Math.max(16 * 1024, 1024 * 1024 - Buffer.byteLength(JSON.stringify(base), "utf8") - 4096);
    const page2 = await pageItems({
      items: files,
      limit,
      codec,
      now,
      expiresAt,
      cursor,
      snapshotId: result.snapshotId,
      scopeKey: result.cursorScopeKey,
      view,
      byteBudget: byteBudget2
    });
    return { ...base, ...page2 };
  }
  const byteBudget = Math.max(16 * 1024, 1024 * 1024 - Buffer.byteLength(JSON.stringify(base), "utf8") - 4096);
  const page = await pageItems({
    items: result.chunks,
    limit,
    codec,
    now,
    expiresAt,
    cursor,
    snapshotId: result.snapshotId,
    scopeKey: result.cursorScopeKey,
    view,
    byteBudget
  });
  return { ...base, ...page };
}
async function snapshot(input, options = {}) {
  return (await scan(input, options)).snapshot;
}
function filterEvidenceChunks(chunks, query, referenceRecords, limit, options, budget) {
  let referenced;
  if (referenceRecords) {
    referenced = /* @__PURE__ */ new Set();
    for (const record of referenceRecords) {
      for (const reference of recordEvidence(record)) {
        consumeSelectorWork(budget, options, "reference-index");
        referenced.add(chunkKey(reference.path, reference.line));
      }
    }
  }
  const matches = [];
  for (const chunk of chunks) {
    consumeSelectorWork(budget, options, "chunk-filter");
    if (chunk.text.includes(query) && (!referenced || referenced.has(chunkKey(chunk.path, chunk.line)))) {
      matches.push(chunk);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}
async function searchEvidence(input, options = {}) {
  const query = typeof input.query === "string" ? input.query : "";
  if (!query) return { matches: [] };
  const budget = createScopeOperationBudget(options);
  const result = await scan(scopeInput(input), options, true, budget);
  const manifest2 = await manifestFor(result, options, budget);
  const domains = input.domain ?? input.domains;
  const statuses = input.status ?? input.statuses;
  if (asArray(domains).length === 0 && asArray(statuses).length === 0) {
    return { matches: filterEvidenceChunks(result.chunks, query, void 0, 100, options, budget) };
  }
  const records = filteredRecords(
    matchingRecords(manifest2, query, [], [], result.chunks, options, budget),
    domains,
    statuses,
    options,
    budget
  );
  return {
    matches: filterEvidenceChunks(result.chunks, query, records, 100, options, budget)
  };
}
async function queryContext(input, options = {}) {
  const query = typeof input.query === "string" ? input.query : "";
  const paths = asArray(input.paths);
  const modules = asArray(input.modules ?? input.module);
  const maxRecords = boundedInteger(input.maxRecords, 20, 100, "maxRecords");
  const maxEvidence = boundedInteger(input.maxEvidence, 100, 500, "maxEvidence");
  const budget = createScopeOperationBudget(options);
  const scope = await resolveScope(scopeInput(input), options, budget);
  const manifest2 = await manifestFor(scope, options, budget);
  const evidencePaths3 = manifest2 ? manifestEvidencePaths(manifest2, budget) : [];
  const result = manifest2 && evidencePaths3.length > 0 ? await scanSelectedPaths(scope.root, evidencePaths3, manifest2.sourceRevision, options, false, budget) : await scan(scopeInput(input), options, false, budget);
  const related = matchingRecords(manifest2, query, paths, modules, result.chunks, options, budget).slice(0, maxRecords);
  const verified = freshnessFor(result, manifest2?.sourceRevision, related, options.now ?? Date.now, manifest2?.schemaVersion);
  const currentStates = verified.records.filter((state) => {
    const lifecycle = state.record.lifecycle;
    const terminal = state.record.status === "superseded" || lifecycle && typeof lifecycle === "object" && !Array.isArray(lifecycle) && lifecycle.state === "terminal";
    return state.verification === "verified" && !terminal;
  });
  const currentRecords = currentStates.map((state) => state.record);
  const withheldRecords = verified.records.flatMap((state) => {
    const lifecycle = state.record.lifecycle;
    const terminal = state.record.status === "superseded" || lifecycle && typeof lifecycle === "object" && !Array.isArray(lifecycle) && lifecycle.state === "terminal";
    const id = typeof state.record.id === "string" ? state.record.id : "unknown-record";
    if (terminal) return [{ id, reason: "terminal", reasons: state.reasons }];
    if (state.verification === "historical") return [{ id, reason: "stale", reasons: state.reasons }];
    if (state.verification === "unverified") return [{ id, reason: "unverified", reasons: state.reasons }];
    return [];
  });
  const hasOnlyWithheldMatches = related.length > 0 && currentRecords.length === 0;
  const context = hasOnlyWithheldMatches ? [] : evidenceForContext(result.chunks, query, paths, modules, currentRecords, result.candidateModules, maxEvidence, options, budget);
  const documents = hasOnlyWithheldMatches ? [] : await documentsForContext(result, manifest2, currentRecords, query, paths, options, budget);
  return {
    context,
    records: currentStates.map((state) => ({ ...state, record: recordSummary(state.record) })),
    withheld: {
      counts: {
        stale: withheldRecords.filter((record) => record.reason === "stale").length,
        unverified: withheldRecords.filter((record) => record.reason === "unverified").length,
        terminal: withheldRecords.filter((record) => record.reason === "terminal").length
      },
      records: withheldRecords
    },
    documents,
    conflicts: currentRecords.flatMap((record) => asArray(record.conflicts)),
    openQuestions: currentRecords.flatMap((record) => asArray(record.openQuestions)),
    freshness: verified.freshness
  };
}
async function detectDrift(input, options = {}) {
  const view = input.view ?? "summary";
  if (view !== "summary" && view !== "details") throw new Error("Drift view must be summary or details");
  const cursor = typeof input.cursor === "string" ? input.cursor : input.cursor === void 0 ? void 0 : (() => {
    throw new Error("Drift cursor must be a string");
  })();
  if (cursor !== void 0) {
    if (view !== "details") throw new Error("A drift cursor requires details view");
    const binding = await driftContinuationScopeBinding(input, options);
    const now2 = options.now?.() ?? Date.now();
    const codec = await createCursorCodec(options, binding.root);
    const decoded = codec.decode(cursor, parseScopeCursorPayload);
    assertContinuationCursorCurrent(decoded, now2);
    if (decoded.scopeKey !== binding.cursorScopeKey || decoded.view !== "details") {
      throw new Error("Drift cursor does not belong to this root, scope, or view");
    }
    const storage = driftCursorStorageBinding(binding.root, decoded.snapshotId, decoded.scopeKey);
    const loaded = await loadScopeIndex({
      options,
      projectRoot: binding.root,
      scopeKey: storage.cursorScopeKey,
      snapshotId: storage.snapshotId,
      now: now2
    });
    if (decoded.expiresAt !== loaded.expiresAt) {
      throw new ScopeSnapshotRestartError("corrupt");
    }
    if (!loaded.details || !loaded.driftSummary) throw new ScopeSnapshotRestartError("corrupt");
    const byteBudget = 1024 * 1024 - Buffer.byteLength(JSON.stringify(loaded.driftSummary), "utf8") - 4096;
    const page2 = await pageItems({
      items: loaded.details,
      limit: scanLimit(input.limit),
      codec,
      now: now2,
      expiresAt: loaded.expiresAt,
      cursor,
      snapshotId: decoded.snapshotId,
      scopeKey: binding.cursorScopeKey,
      view: "details",
      byteBudget
    });
    return { ...loaded.driftSummary, ...page2 };
  }
  const source = scopeInput(input);
  const budget = createScopeOperationBudget(options);
  const scope = await resolveScope(source, options, budget);
  const manifest2 = await manifestFor(scope, options, budget);
  const pack = typeof input.pack === "object" && input.pack !== null ? input.pack : void 0;
  const directPackRecords = pack ? boundedPackRecords(pack.records, options, budget) : void 0;
  const packLimits = resolveKeeperLimits(options.limits).pack;
  const rawRequiredEvidence = pack?.requiredEvidence ?? input.requiredEvidence;
  if (Array.isArray(rawRequiredEvidence) && rawRequiredEvidence.length > packLimits.maxEvidencePerRecord) {
    throw new Error(`Pack required evidence exceeds the limit of ${packLimits.maxEvidencePerRecord}`);
  }
  const previousSnapshot = input.previousSnapshot ?? input.sourceRevision ?? pack?.sourceRevision ?? manifest2?.sourceRevision;
  const hasDeclaredPackRevision = input.sourceRevision !== void 0 || pack?.sourceRevision !== void 0 || manifest2?.sourceRevision !== void 0 || pack?.scope !== void 0 || manifest2?.scope !== void 0;
  const scopePaths = hasDeclaredPackRevision ? declaredScopePaths(pack ?? manifest2, previousSnapshot, budget) : [];
  const result = scopePaths.length > 0 ? await scanSelectedPaths(scope.root, scopePaths, previousSnapshot, options, false, budget) : await scan({ ...source, previousSnapshot }, options, false, budget);
  const requiredEvidence = asArray(rawRequiredEvidence);
  const compatibilityWork = new CounterBudget("Drift compatibility evidence work", Math.max(1024, budget.maxEvidence * 8));
  const compatibilityDrift = [];
  for (const required of requiredEvidence) {
    budget.deadline.check();
    let found = false;
    for (const chunk of result.chunks) {
      compatibilityWork.consume();
      budget.deadline.check();
      if (chunk.text.includes(required)) {
        found = true;
        break;
      }
    }
    if (!found) compatibilityDrift.push({ kind: "missing-evidence", evidence: required });
  }
  const records = directPackRecords ?? manifest2?.records ?? [];
  const changed = new Set(result.changed.map(pathKey));
  const deleted = new Set(result.deleted.map(pathKey));
  const currentFiles = new Set(Object.keys(result.fingerprints).map(pathKey));
  const indexedChunks = chunkLookup(result.chunks);
  const filesByPath = new Map(result.indexedFiles.map((file) => [pathKey(file.path), file]));
  const evidenceByPath = /* @__PURE__ */ new Map();
  for (const chunk of result.chunks) {
    budget.deadline.check();
    const key = pathKey(chunk.path);
    const lines = evidenceByPath.get(key) ?? /* @__PURE__ */ new Map();
    lines.set(chunk.line, chunk);
    evidenceByPath.set(key, lines);
  }
  const recordEvidenceWork = new CounterBudget(
    "Drift record evidence work",
    Math.max(1, packLimits.maxRecords * packLimits.maxEvidencePerRecord)
  );
  const recordDrift = [];
  for (const record of records) {
    budget.deadline.check();
    for (const parsed of recordEvidence(record)) {
      recordEvidenceWork.consume();
      budget.deadline.check();
      const evidence = parsed.reference;
      const recordId = typeof record.id === "string" ? record.id : "unknown-record";
      const key = pathKey(parsed.path);
      const file = filesByPath.get(key);
      if (deleted.has(key)) recordDrift.push({ kind: "deleted-evidence", recordId, evidence });
      else if (!currentFiles.has(key) || !file) recordDrift.push({ kind: "missing-evidence", recordId, evidence });
      else if (parsed.endLine !== void 0 && parsed.endLine > file.lineCount || !referencedChunk(indexedChunks, parsed)) {
        recordDrift.push({ kind: "invalid-evidence", recordId, evidence, reason: "line-invalid" });
      } else if (changed.has(key)) recordDrift.push({ kind: "modified-evidence", recordId, evidence });
    }
  }
  const relocationWork = new CounterBudget("Drift relocation work", Math.max(1024, budget.maxEvidence * 8));
  const relocationCandidates = [];
  for (const record of records) {
    budget.deadline.check();
    for (const evidence of typedRecordEvidence(record)) {
      budget.deadline.check();
      const key = pathKey(evidence.path);
      const file = filesByPath.get(key);
      if (!file || evidence.startLine > file.lineCount || evidence.endLine > file.lineCount) continue;
      const fileEvidence = evidenceByPath.get(key) ?? /* @__PURE__ */ new Map();
      const span = evidence.endLine - evidence.startLine + 1;
      const excerptAt = (startLine) => {
        const parts = [];
        for (let offset = 0; offset < span; offset += 1) {
          relocationWork.consume();
          budget.deadline.check();
          const chunk = fileEvidence.get(startLine + offset);
          if (!chunk || chunk.truncated) return void 0;
          parts.push(chunk.text);
        }
        return parts.join("\n");
      };
      const current = excerptAt(evidence.startLine);
      if (current !== void 0 && sha256(Buffer.from(current, "utf8")) === evidence.excerptHash) continue;
      const matches = [];
      for (let line = 1; line + span - 1 <= file.lineCount; line += 1) {
        budget.deadline.check();
        const excerpt = excerptAt(line);
        if (excerpt !== void 0 && sha256(Buffer.from(excerpt, "utf8")) === evidence.excerptHash) {
          matches.push(line);
          if (matches.length > 1) break;
        }
      }
      if (matches.length !== 1 || matches[0] === evidence.startLine) continue;
      const relocatedEnd = matches[0] + span - 1;
      relocationCandidates.push({
        recordId: typeof record.id === "string" ? record.id : "unknown-record",
        evidenceIndex: evidence.evidenceIndex,
        path: evidence.path,
        from: { startLine: evidence.startLine, ...evidence.endLine !== evidence.startLine ? { endLine: evidence.endLine } : {} },
        to: { startLine: matches[0], ...relocatedEnd !== matches[0] ? { endLine: relocatedEnd } : {} }
      });
    }
  }
  const archiveEligibleRecordIds = records.flatMap((record) => {
    const lifecycle = record.lifecycle;
    if (!lifecycle || typeof lifecycle !== "object" || Array.isArray(lifecycle)) return [];
    const terminal = lifecycle;
    return terminal.state === "terminal" && Number.isSafeInteger(terminal.confirmedRefreshes) && Number(terminal.confirmedRefreshes) >= 2 && typeof record.id === "string" ? [record.id] : [];
  });
  const drift = [...recordDrift, ...compatibilityDrift];
  const invalidatedRecordIds = [...new Set(recordDrift.flatMap((item) => "recordId" in item && typeof item.recordId === "string" ? [item.recordId] : []))];
  const hasRevision = Object.keys(revisionFiles(previousSnapshot)).length > 0;
  const stale = result.changed.length > 0 || result.new.length > 0 || result.deleted.length > 0 || drift.length > 0;
  const freshness = !hasRevision ? "unknown" : stale ? "stale" : "fresh";
  const summary = {
    freshness,
    counts: {
      new: result.new.length,
      modified: result.changed.length,
      deleted: result.deleted.length,
      invalidated: invalidatedRecordIds.length
    },
    invalidatedRecordIds,
    relocationCandidates,
    archiveEligibleRecordIds
  };
  if (view === "summary") {
    return summary;
  }
  const details = [
    ...result.new.map((path) => ({ kind: "new", path })),
    ...result.changed.map((path) => ({ kind: "modified", path })),
    ...result.deleted.map((path) => ({ kind: "deleted", path })),
    ...drift
  ];
  const limit = scanLimit(input.limit);
  result.snapshotId = scopeSnapshotIdForContent({
    scopePaths: result.scopePaths,
    files: result.indexedFiles,
    evidence: result.chunks,
    candidateModules: result.candidateModules,
    omissions: result.omissions,
    details,
    driftSummary: summary
  });
  const persisted = await persistScopeIndex({
    options,
    projectRoot: result.root,
    scopePaths: result.scopePaths,
    snapshotId: result.snapshotId,
    files: result.indexedFiles,
    evidence: result.chunks,
    candidateModules: result.candidateModules,
    omissions: result.omissions,
    details,
    driftSummary: summary
  });
  result.snapshotExpiresAt = persisted.expiresAt;
  const now = options.now?.() ?? Date.now();
  const requestScopeSelection = driftRequestScopeSelection(input, budget);
  const page = await pageItems({
    items: details,
    limit,
    codec: await createCursorCodec(options, result.root),
    now,
    expiresAt: result.snapshotExpiresAt,
    cursor,
    snapshotId: driftCursorSnapshotBinding(result.snapshotId, result.scopePaths),
    scopeKey: driftRequestCursorScopeKey(result.root, requestScopeSelection),
    view: "details",
    byteBudget: 1024 * 1024 - Buffer.byteLength(JSON.stringify(summary), "utf8") - 4096
  });
  return { ...summary, ...page };
}
function createScopeService(options = {}) {
  return {
    resolveScope,
    scanScope: (input) => scanScope(input, options),
    searchEvidence: (input) => searchEvidence(input, options),
    detectDrift: (input) => detectDrift(input, options),
    queryContext: (input) => queryContext(input, options),
    snapshot: (input) => snapshot(input, options)
  };
}

// src/transactions.ts
import { createHash as createHash9, randomUUID as randomUUID3 } from "node:crypto";
import { lstat as lstat9, mkdir as mkdir2, open as open9, opendir as opendir6, readdir as readdir2, realpath as realpath7, rename as rename3, rmdir as rmdir2, unlink as unlink2 } from "node:fs/promises";
import { homedir as homedir2 } from "node:os";
import { basename as basename4, dirname as dirname5, isAbsolute as isAbsolute5, join as join7, relative as relative5, resolve as resolve7, win32 as win322 } from "node:path";
import { isDeepStrictEqual } from "node:util";

// src/security/process-lock.ts
import { createHash as createHash5, randomBytes as randomBytes4, randomUUID as randomUUID2 } from "node:crypto";
import { lstat as lstat6, open as open6, realpath as realpath5, rename as rename2, unlink } from "node:fs/promises";
import { join as join5 } from "node:path";
import { performance as performance5 } from "node:perf_hooks";
var defaultTimeoutMs = 3e4;
var defaultLeaseMs = 3e4;
var maximumDurationMs = 5 * 6e4;
var maximumOwnerBytes = 4 * 1024;
var fixedOwnerBytes = 512;
var pollingIntervalMs = 25;
var finalReconcileMs = 5e3;
var processLeaseQueues = /* @__PURE__ */ new Map();
var ProjectLeaseDeadlineError = class extends Error {
  pendingOperation;
};
var ProjectLeaseClockError = class extends Error {
};
var InvalidProcessLeaseOwnerError = class extends Error {
};
var TransientProcessLeaseObservationError = class extends Error {
};
var AmbiguousProcessLeaseCleanupError = class extends Error {
};
function duration(value, fallback, label) {
  const selected2 = value ?? fallback;
  if (!Number.isSafeInteger(selected2) || selected2 <= 0 || selected2 > maximumDurationMs) {
    throw new Error(`${label} must be a positive bounded integer`);
  }
  return selected2;
}
function wallTime(now) {
  const value = now();
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Project lease timestamp is invalid");
  return value;
}
function monotonicTime(now, previous) {
  const value = now();
  if (!Number.isFinite(value) || value < 0) throw new ProjectLeaseClockError("Project lease monotonic clock is invalid");
  if (previous !== void 0 && value < previous) throw new ProjectLeaseClockError("Project lease monotonic clock moved backwards");
  return value;
}
function createDeadline(now, timeoutMs, reconcileMs = finalReconcileMs) {
  const start = monotonicTime(now);
  const expiresAt = start + timeoutMs;
  const reconcileExpiresAt = expiresAt + reconcileMs;
  if (!Number.isFinite(expiresAt) || !Number.isFinite(reconcileExpiresAt)) {
    throw new ProjectLeaseClockError("Project lease monotonic deadline is invalid");
  }
  return { expiresAt, reconcileExpiresAt, now, last: start };
}
function deadlineRemaining(deadline, context, boundary = "operation") {
  const current = monotonicTime(deadline.now, deadline.last);
  deadline.last = current;
  const remaining = (boundary === "operation" ? deadline.expiresAt : deadline.reconcileExpiresAt) - current;
  if (remaining <= 0) throw new ProjectLeaseDeadlineError(`Project lease timeout ${context}`);
  return remaining;
}
function deadlineFailure(error, seen = /* @__PURE__ */ new Set()) {
  if (error === null || error === void 0 || seen.has(error)) return false;
  seen.add(error);
  if (error instanceof ProjectLeaseDeadlineError || error instanceof ProjectLeaseClockError) return true;
  if (error instanceof AggregateError && error.errors.some((nested) => deadlineFailure(nested, seen))) return true;
  return error instanceof Error && error.cause !== void 0 && deadlineFailure(error.cause, seen);
}
function pendingDeadlineOperation(error, seen = /* @__PURE__ */ new Set()) {
  if (error === null || error === void 0 || seen.has(error)) return void 0;
  seen.add(error);
  if (error instanceof ProjectLeaseDeadlineError && error.pendingOperation) return error.pendingOperation;
  if (error instanceof AggregateError) {
    for (const nested of error.errors) {
      const pending = pendingDeadlineOperation(nested, seen);
      if (pending) return pending;
    }
  }
  if (error instanceof Error && error.cause !== void 0) return pendingDeadlineOperation(error.cause, seen);
  return void 0;
}
function unresolvedLeaseWork(observed) {
  return observed.unresolvedWork;
}
function deferHandleCloseAfterSettlement(handle, pending) {
  void pending.settlement.then(() => {
    let closing;
    try {
      closing = handle.close();
    } catch {
      return;
    }
    void closing.catch(() => void 0);
  }).catch(() => void 0);
}
function deferLateOpenedHandleClose(pending) {
  void pending.settlement.then((outcome) => {
    if (outcome.status !== "fulfilled") return;
    let closing;
    try {
      closing = outcome.value.close();
    } catch {
      return;
    }
    void closing.catch(() => void 0);
  }).catch(() => void 0);
}
async function withinDeadline(deadline, context, operation, options = {}) {
  const boundary = options.boundary ?? "operation";
  const remaining = deadlineRemaining(deadline, `before ${context}`, boundary);
  let timer;
  try {
    let tracked;
    const pending = Promise.resolve().then(operation);
    const settlement = pending.then(
      (value) => {
        tracked.settled = true;
        return { status: "fulfilled", value };
      },
      (error) => {
        tracked.settled = true;
        return { status: "rejected", error };
      }
    );
    tracked = { context, boundary, settlement, settled: false };
    const timedOut = Symbol("project-lease-timeout");
    const selected2 = await Promise.race([
      settlement,
      new Promise((accept) => {
        timer = setTimeout(() => accept(timedOut), remaining);
        timer.unref?.();
      })
    ]);
    if (selected2 === timedOut) {
      const error = new ProjectLeaseDeadlineError(`Project lease timeout during ${context}`);
      error.pendingOperation = tracked;
      throw error;
    }
    if (selected2.status === "rejected") throw selected2.error;
    deadlineRemaining(deadline, `after ${context}`, boundary);
    return selected2.value;
  } catch (error) {
    if (deadlineFailure(error)) throw error;
    deadlineRemaining(deadline, `after failed ${context}`, boundary);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function mandatoryClose(handle, deadline, context, blockedBy) {
  if (blockedBy && !blockedBy.settled) {
    deferHandleCloseAfterSettlement(handle, blockedBy);
    throw new AmbiguousProcessLeaseCleanupError(
      `Project lease ${context} was deferred behind unresolved ${blockedBy.context}; preserving owned evidence`
    );
  }
  await withinDeadline(deadline, context, () => handle.close(), { boundary: "reconcile" });
}
function canonicalDigest(path) {
  const normalized3 = process.platform === "win32" ? path.toLocaleLowerCase("en-US") : path;
  return createHash5("sha256").update(normalized3, "utf8").digest("hex");
}
function lockPath(layout, projectDigest2) {
  return join5(layout.locks, `task8-${projectDigest2}.lock`);
}
function sameIdentity2(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.kind === right.kind && left.parentDev === right.parentDev && left.parentIno === right.parentIno && sameFilesystemPath(left.path, right.path) && sameFilesystemPath(left.parent, right.parent);
}
function sameIdentityAcrossRename(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.kind === right.kind && left.parentDev === right.parentDev && left.parentIno === right.parentIno && sameFilesystemPath(left.parent, right.parent);
}
function sameLeaseFileVersion(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.gid === right.gid && left.mode === right.mode && left.nlink === right.nlink && left.size === right.size && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs && left.isFile() && right.isFile() && !left.isSymbolicLink() && !right.isSymbolicLink();
}
function sameOwner(left, right) {
  return left.version === right.version && left.pid === right.pid && left.nonce === right.nonce && left.createdAtMs === right.createdAtMs && left.renewedAtMs === right.renewedAtMs && left.leaseMs === right.leaseMs && left.projectDigest === right.projectDigest;
}
function ownerBytes(owner) {
  const bytes = Buffer.from(`${JSON.stringify(owner)}
`, "utf8");
  if (bytes.byteLength > fixedOwnerBytes) throw new Error("Project lease owner metadata exceeds its bound");
  return Buffer.from(bytes.toString("utf8").padEnd(fixedOwnerBytes, " "), "utf8");
}
function invalidOwner2() {
  throw new InvalidProcessLeaseOwnerError("Project lease owner metadata is invalid or ambiguous");
}
function parseOwner(value, expectedProjectDigest) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidOwner2();
  const record = value;
  const expectedKeys = ["createdAtMs", "leaseMs", "nonce", "pid", "projectDigest", "renewedAtMs", "version"];
  const keys = Object.keys(record).sort((left, right) => left.localeCompare(right, "en-US"));
  if (keys.length !== expectedKeys.length || keys.some((key, index2) => key !== expectedKeys[index2])) invalidOwner2();
  if (record.version !== 1 || !Number.isSafeInteger(record.pid) || Number(record.pid) <= 0 || Number(record.pid) > 2147483647 || typeof record.nonce !== "string" || !/^[a-f0-9]{32}$/u.test(record.nonce) || !Number.isSafeInteger(record.createdAtMs) || Number(record.createdAtMs) < 0 || !Number.isSafeInteger(record.renewedAtMs) || Number(record.renewedAtMs) < Number(record.createdAtMs) || !Number.isSafeInteger(record.leaseMs) || Number(record.leaseMs) <= 0 || Number(record.leaseMs) > maximumDurationMs || typeof record.projectDigest !== "string" || !/^[a-f0-9]{64}$/u.test(record.projectDigest) || record.projectDigest !== expectedProjectDigest) invalidOwner2();
  return {
    version: 1,
    pid: Number(record.pid),
    nonce: record.nonce,
    createdAtMs: Number(record.createdAtMs),
    renewedAtMs: Number(record.renewedAtMs),
    leaseMs: Number(record.leaseMs),
    projectDigest: record.projectDigest
  };
}
async function optionalObservedLease(layout, path, projectDigest2, deadline, boundary = "operation", hooks = {}) {
  let metadata;
  try {
    metadata = await withinDeadline(deadline, "lease-path metadata read", () => lstat6(path, { bigint: true }), { boundary });
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
  try {
    assertSecureOwnerFileMetadata(metadata, path, 1n);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown owner metadata failure";
    throw new InvalidProcessLeaseOwnerError(`Project lease owner file security metadata is invalid: ${detail}`, { cause: error });
  }
  if (metadata.size <= 0n) {
    throw new TransientProcessLeaseObservationError("Project lease owner publication is not complete");
  }
  if (metadata.size > BigInt(maximumOwnerBytes)) invalidOwner2();
  const identity = await withinDeadline(
    deadline,
    "lease-path identity capture",
    () => captureSecurePathIdentity(layout, path, "file"),
    { boundary }
  );
  if (hooks.beforeObservedLeaseRead) {
    await withinDeadline(
      deadline,
      "observed-lease read hook",
      () => hooks.beforeObservedLeaseRead(path),
      { boundary }
    );
  }
  let handle;
  let bytes;
  let primaryError;
  try {
    try {
      handle = await withinDeadline(deadline, "lease owner handle open", () => open6(path, "r"), { boundary });
    } catch (error) {
      const pending = pendingDeadlineOperation(error);
      if (pending) deferLateOpenedHandleClose(pending);
      throw error;
    }
    const before = await withinDeadline(
      deadline,
      "lease owner initial handle metadata",
      () => handle.stat({ bigint: true }),
      { boundary }
    );
    if (!sameLeaseFileVersion(metadata, before) || before.dev !== identity.dev || before.ino !== identity.ino) {
      throw new TransientProcessLeaseObservationError("Project lease identity changed during bounded read");
    }
    try {
      assertSecureOwnerFileMetadata(before, path, 1n);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown owner metadata failure";
      throw new InvalidProcessLeaseOwnerError(`Project lease owner handle security metadata is invalid: ${detail}`, { cause: error });
    }
    const buffer = Buffer.alloc(maximumOwnerBytes + 1);
    let offset = 0;
    for (; ; ) {
      deadlineRemaining(deadline, "before a lease-owner read iteration", boundary);
      const read = await withinDeadline(
        deadline,
        "lease owner bounded read chunk",
        () => handle.read(buffer, offset, buffer.byteLength - offset, offset),
        { boundary }
      );
      offset += read.bytesRead;
      if (hooks.afterObservedLeaseReadChunk) {
        await withinDeadline(
          deadline,
          "lease owner read-chunk hook",
          () => hooks.afterObservedLeaseReadChunk(path, offset),
          { boundary }
        );
      }
      if (read.bytesRead === 0) break;
      if (offset === buffer.byteLength) invalidOwner2();
    }
    bytes = buffer.subarray(0, offset);
    const after = await withinDeadline(
      deadline,
      "lease owner final handle metadata",
      () => handle.stat({ bigint: true }),
      { boundary }
    );
    if (!sameLeaseFileVersion(before, after) || after.dev !== identity.dev || after.ino !== identity.ino || after.size !== BigInt(offset)) {
      throw new TransientProcessLeaseObservationError("Project lease identity changed during bounded read");
    }
  } catch (error) {
    primaryError = error;
  }
  let closeError;
  if (handle) {
    try {
      await mandatoryClose(handle, deadline, "owner-read handle close", pendingDeadlineOperation(primaryError));
    } catch (error) {
      closeError = error;
    }
  }
  if (primaryError !== void 0 && closeError !== void 0) {
    throw new AggregateError(
      [primaryError, closeError],
      "Project lease owner read and handle cleanup both failed",
      { cause: primaryError }
    );
  }
  if (primaryError !== void 0) throw primaryError;
  if (closeError !== void 0) throw closeError;
  const [finalMetadata, finalParentMetadata, finalCanonical] = await withinDeadline(
    deadline,
    "lease owner final path and parent validation",
    () => Promise.all([
      lstat6(path, { bigint: true }),
      lstat6(identity.parent, { bigint: true }),
      realpath5(path)
    ]),
    { boundary }
  );
  if (!sameLeaseFileVersion(metadata, finalMetadata) || finalParentMetadata.dev !== identity.parentDev || finalParentMetadata.ino !== identity.parentIno || finalParentMetadata.isSymbolicLink() || !finalParentMetadata.isDirectory() || !sameFilesystemPath(finalCanonical, identity.path)) {
    throw new TransientProcessLeaseObservationError("Project lease version changed after bounded read");
  }
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    invalidOwner2();
  }
  deadlineRemaining(deadline, "after lease owner parse", boundary);
  return { owner: parseOwner(parsed, projectDigest2), identity, metadata: finalMetadata };
}
async function createLease(layout, path, owner, deadline, hooks) {
  let handle;
  let parentIdentity;
  let primaryError;
  let publicationCompleted = false;
  let publishedMetadata;
  try {
    handle = await withinDeadline(deadline, "exclusive lease create", () => open6(path, "wx", 384));
  } catch (error) {
    if (error.code === "EEXIST") return void 0;
    const pending = pendingDeadlineOperation(error);
    if (pending) deferLateOpenedHandleClose(pending);
    throw error;
  }
  try {
    parentIdentity = await withinDeadline(
      deadline,
      "lease parent identity capture",
      () => captureSecurePathIdentity(layout, layout.locks, "directory"),
      { boundary: primaryError === void 0 ? "operation" : "reconcile" }
    );
  } catch (error) {
    primaryError = primaryError === void 0 ? error : new AggregateError([primaryError, error], "Project lease parent identity capture failed", { cause: primaryError });
  }
  let created;
  try {
    if (!pendingDeadlineOperation(primaryError)) {
      created = await withinDeadline(
        deadline,
        "created lease handle metadata",
        () => handle.stat({ bigint: true }),
        { boundary: primaryError === void 0 ? "operation" : "reconcile" }
      );
      assertSecureOwnerFileMetadata(created, path, 1n);
    }
    if (primaryError === void 0) {
      if (!created) throw new Error("Project lease handle identity was unavailable before owner publication");
      await withinDeadline(deadline, "lease owner write", () => handle.writeFile(ownerBytes(owner)));
      await withinDeadline(deadline, "lease owner file sync", () => handle.sync());
      publishedMetadata = await withinDeadline(
        deadline,
        "published lease handle metadata",
        () => handle.stat({ bigint: true })
      );
      assertSecureOwnerFileMetadata(publishedMetadata, path, 1n);
      if (publishedMetadata.dev !== created.dev || publishedMetadata.ino !== created.ino) {
        throw new Error("Project lease handle identity changed during owner publication");
      }
      publicationCompleted = true;
    }
  } catch (error) {
    primaryError = primaryError === void 0 ? error : new AggregateError([primaryError, error], "Project lease creation steps failed", { cause: primaryError });
  }
  try {
    await mandatoryClose(handle, deadline, "creation handle close", pendingDeadlineOperation(primaryError));
  } catch (error) {
    primaryError = primaryError === void 0 ? error : new AggregateError([primaryError, error], "Project lease creation and handle cleanup both failed", { cause: primaryError });
  }
  if (pendingDeadlineOperation(primaryError)) {
    const ambiguity = new AmbiguousProcessLeaseCleanupError(
      "Project lease creation has unresolved lease-owned I/O; preserving the exclusively created inode"
    );
    throw new AggregateError(
      [primaryError, ambiguity],
      "Project lease creation timed out and owned-file cleanup remains ambiguous",
      { cause: primaryError }
    );
  }
  if (primaryError === void 0 && hooks.beforeCreatedPathIdentityCapture) {
    try {
      await withinDeadline(
        deadline,
        "pre-created-path identity hook",
        () => hooks.beforeCreatedPathIdentityCapture(path)
      );
    } catch (error) {
      primaryError = error;
    }
  }
  if (pendingDeadlineOperation(primaryError)) {
    const ambiguity = new AmbiguousProcessLeaseCleanupError(
      "Project lease created-path hook remains unresolved; preserving the exact published owner evidence"
    );
    throw new AggregateError(
      [primaryError, ambiguity],
      "Project lease creation timed out and created-path reconciliation remains ambiguous",
      { cause: primaryError }
    );
  }
  if (!created) {
    const captureError = new Error("Project lease identity was not captured from the owned handle");
    primaryError = primaryError === void 0 ? captureError : new AggregateError([primaryError, captureError], "Project lease handle identity capture failed", { cause: primaryError });
  }
  let identity;
  try {
    identity = await withinDeadline(
      deadline,
      "created lease path identity capture",
      () => captureSecurePathIdentity(layout, path, "file"),
      { boundary: "reconcile" }
    );
  } catch (error) {
    throw primaryError === void 0 ? error : new AggregateError(
      [primaryError, error],
      "Project lease creation failed and created identity capture was ambiguous",
      { cause: primaryError }
    );
  }
  const pathIsExactCreatedInode = created !== void 0 && created.dev === identity.dev && created.ino === identity.ino;
  const parentIsExact = parentIdentity !== void 0 && identity.parentDev === parentIdentity.dev && identity.parentIno === parentIdentity.ino && sameFilesystemPath(identity.parent, parentIdentity.path);
  if (!parentIsExact || !pathIsExactCreatedInode) {
    const identityError = new Error("Project lease identity changed during exclusive creation");
    primaryError = primaryError === void 0 ? identityError : new AggregateError([primaryError, identityError], "Project lease creation identity was ambiguous", { cause: primaryError });
  }
  let verifiedLease;
  if (publicationCompleted && publishedMetadata && pathIsExactCreatedInode && parentIsExact) {
    try {
      const observed = await optionalObservedLease(
        layout,
        path,
        owner.projectDigest,
        deadline,
        "reconcile"
      );
      if (!observed || !sameIdentity2(observed.identity, identity) || !sameOwner(observed.owner, owner) || !sameLeaseFileVersion(observed.metadata, publishedMetadata)) {
        throw new Error("Project lease persisted owner or version changed during exclusive creation");
      }
      verifiedLease = observed;
    } catch (error) {
      primaryError = primaryError === void 0 ? error : new AggregateError([primaryError, error], "Project lease persisted owner verification was ambiguous", { cause: primaryError });
    }
  }
  if (primaryError === void 0) {
    try {
      deadlineRemaining(deadline, "after exclusive lease creation");
    } catch (error) {
      primaryError = error;
    }
  }
  if (primaryError !== void 0) {
    if (!pathIsExactCreatedInode || !parentIsExact || publicationCompleted && !verifiedLease) throw primaryError;
    try {
      if (publicationCompleted) {
        const current = await optionalObservedLease(
          layout,
          path,
          owner.projectDigest,
          deadline,
          "reconcile"
        );
        if (!current || !verifiedLease || !sameIdentity2(current.identity, verifiedLease.identity) || !sameOwner(current.owner, owner) || !sameLeaseFileVersion(current.metadata, verifiedLease.metadata)) {
          throw new Error("Project lease persisted owner changed before failed-create cleanup");
        }
        identity = current.identity;
      }
      await withinDeadline(
        deadline,
        "failed-create exact identity validation",
        () => validateSecurePathIdentity(layout, identity),
        { boundary: "reconcile" }
      );
      const cleanupMetadata = await withinDeadline(
        deadline,
        "failed-create exact metadata validation",
        () => lstat6(identity.path, { bigint: true }),
        { boundary: "reconcile" }
      );
      assertSecureOwnerFileMetadata(cleanupMetadata, identity.path, 1n);
      if (cleanupMetadata.dev !== identity.dev || cleanupMetadata.ino !== identity.ino) {
        throw new Error("Project lease created identity changed before failed-create cleanup");
      }
      await withinDeadline(
        deadline,
        "failed-create exact unlink",
        () => unlink(identity.path),
        { boundary: "reconcile" }
      );
    } catch (cleanupError) {
      throw new AggregateError(
        [primaryError, cleanupError],
        "Project lease creation failed and owned-file cleanup was ambiguous",
        { cause: primaryError }
      );
    }
    throw primaryError;
  }
  if (!verifiedLease) throw new Error("Project lease persisted owner was not verified after exclusive creation");
  return verifiedLease;
}
async function removeObservedLease(layout, path, expected, deadline, boundary = "operation", hooks = {}) {
  if (hooks.beforeLeaseRelease) {
    await withinDeadline(
      deadline,
      "lease release hook",
      () => hooks.beforeLeaseRelease(path),
      { boundary }
    );
  }
  const current = await optionalObservedLease(layout, path, expected.owner.projectDigest, deadline, boundary, hooks);
  if (!current || !sameIdentity2(current.identity, expected.identity) || !sameOwner(current.owner, expected.owner) || !sameLeaseFileVersion(current.metadata, expected.metadata)) {
    throw new Error("Project lease ownership or identity changed before release");
  }
  const quarantine = join5(layout.locks, `.task8-release-${randomUUID2()}.lock`);
  try {
    await withinDeadline(deadline, "release quarantine absence check", () => lstat6(quarantine), { boundary });
    throw new Error("Project lease release quarantine was unexpectedly occupied");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await withinDeadline(
    deadline,
    "pre-release lease identity validation",
    () => validateSecurePathIdentity(layout, expected.identity),
    { boundary }
  );
  let renamed = false;
  let unlinked = false;
  let primaryError;
  const exactQuarantineCleanup = async (cleanupBoundary) => {
    const quarantined = await optionalObservedLease(
      layout,
      quarantine,
      expected.owner.projectDigest,
      deadline,
      cleanupBoundary,
      hooks
    );
    if (!quarantined || !sameIdentityAcrossRename(expected.identity, quarantined.identity) || !sameOwner(expected.owner, quarantined.owner)) {
      throw new Error("Project lease identity or ownership changed across release quarantine rename");
    }
    await withinDeadline(
      deadline,
      "released lease identity validation",
      () => validateSecurePathIdentity(layout, quarantined.identity),
      { boundary: cleanupBoundary }
    );
    const cleanupMetadata = await withinDeadline(
      deadline,
      "released lease exact metadata validation",
      () => lstat6(quarantine, { bigint: true }),
      { boundary: cleanupBoundary }
    );
    assertSecureOwnerFileMetadata(cleanupMetadata, quarantine, 1n);
    if (!sameLeaseFileVersion(cleanupMetadata, quarantined.metadata)) {
      throw new Error("Project lease quarantine identity changed before exact unlink");
    }
    await withinDeadline(deadline, "released lease quarantine unlink", async () => {
      await unlink(quarantine);
      unlinked = true;
    }, { boundary: cleanupBoundary });
  };
  try {
    await withinDeadline(deadline, "lease release quarantine rename", async () => {
      await rename2(path, quarantine);
      renamed = true;
    }, { boundary });
    if (hooks.afterLeaseReleaseQuarantineRename) {
      await withinDeadline(
        deadline,
        "post-release quarantine rename hook",
        () => hooks.afterLeaseReleaseQuarantineRename(path, quarantine),
        { boundary }
      );
    }
    await exactQuarantineCleanup(boundary);
    return;
  } catch (error) {
    primaryError = error;
  }
  if (pendingDeadlineOperation(primaryError)) {
    throw new AggregateError(
      [
        primaryError,
        new AmbiguousProcessLeaseCleanupError(
          "Project lease release has unresolved lease-owned I/O; preserving lock or quarantine evidence"
        )
      ],
      "Project lease release timed out and exact reconciliation remains ambiguous",
      { cause: primaryError }
    );
  }
  if (!renamed || unlinked) throw primaryError;
  try {
    await exactQuarantineCleanup("reconcile");
  } catch (reconcileError) {
    throw new AggregateError(
      [primaryError, reconcileError],
      "Project lease release failed after quarantine rename and exact reconciliation was ambiguous",
      { cause: primaryError }
    );
  }
  throw primaryError;
}
async function writeExactRenewalOwner(handle, bytes, deadline, boundary, writeChunk, onWriteAttempt) {
  let offset = 0;
  while (offset < bytes.byteLength) {
    deadlineRemaining(deadline, "before a lease-renewal write iteration", boundary);
    const written = await withinDeadline(
      deadline,
      "lease renewal write chunk",
      () => {
        onWriteAttempt?.();
        return writeChunk ? writeChunk(handle, bytes, offset) : handle.write(bytes, offset, bytes.byteLength - offset, offset);
      },
      { boundary }
    );
    if (!Number.isSafeInteger(written.bytesWritten) || written.bytesWritten <= 0 || written.bytesWritten > bytes.byteLength - offset) {
      throw new Error("Project lease renewal write was incomplete");
    }
    offset += written.bytesWritten;
  }
}
async function renewLease(layout, path, observed, now, deadline, hooks = {}) {
  if (hooks.beforeLeaseRenewal) {
    await withinDeadline(
      deadline,
      "lease renewal hook",
      () => hooks.beforeLeaseRenewal(path)
    );
  }
  const current = await optionalObservedLease(layout, path, observed.owner.projectDigest, deadline, "operation", hooks);
  if (!current || !sameIdentity2(current.identity, observed.identity) || !sameOwner(current.owner, observed.owner) || !sameLeaseFileVersion(current.metadata, observed.metadata)) {
    throw new Error("Project lease ownership or identity changed before renewal");
  }
  deadlineRemaining(deadline, "before renewal wall-clock sample");
  const renewedAtMs = wallTime(now);
  deadlineRemaining(deadline, "after renewal wall-clock sample");
  if (renewedAtMs < observed.owner.renewedAtMs) throw new Error("Project lease clock moved backwards during renewal");
  const renewed = { ...observed.owner, renewedAtMs };
  const bytes = ownerBytes(renewed);
  let handle;
  let primaryError;
  let writeMayHaveChangedOwner = false;
  let renewedHandleMetadata;
  try {
    try {
      handle = await withinDeadline(deadline, "renewal handle open", () => open6(path, "r+"));
    } catch (error) {
      const pending = pendingDeadlineOperation(error);
      if (pending) deferLateOpenedHandleClose(pending);
      throw error;
    }
    if (hooks.afterLeaseRenewalOpen) {
      await withinDeadline(
        deadline,
        "post-renewal handle-open hook",
        () => hooks.afterLeaseRenewalOpen(path)
      );
    }
    const before = await withinDeadline(
      deadline,
      "pre-renewal handle metadata",
      () => handle.stat({ bigint: true })
    );
    try {
      assertSecureOwnerFileMetadata(before, path, 1n);
    } catch (error) {
      throw new InvalidProcessLeaseOwnerError("Project lease owner security metadata changed before renewal write", { cause: error });
    }
    if (!sameLeaseFileVersion(current.metadata, before) || before.dev !== observed.identity.dev || before.ino !== observed.identity.ino) {
      throw new Error("Project lease owner version or identity changed before renewal write");
    }
    await writeExactRenewalOwner(
      handle,
      bytes,
      deadline,
      "operation",
      hooks.writeLeaseRenewal,
      () => {
        writeMayHaveChangedOwner = true;
      }
    );
    if (hooks.afterLeaseRenewalWrite) {
      await withinDeadline(
        deadline,
        "post-renewal write hook",
        () => hooks.afterLeaseRenewalWrite(path)
      );
    }
    await withinDeadline(deadline, "lease renewal truncate", () => handle.truncate(bytes.byteLength));
    await withinDeadline(deadline, "lease renewal file sync", () => handle.sync());
    renewedHandleMetadata = await withinDeadline(
      deadline,
      "post-renewal handle metadata",
      () => handle.stat({ bigint: true })
    );
    assertSecureOwnerFileMetadata(renewedHandleMetadata, path, 1n);
    if (renewedHandleMetadata.dev !== observed.identity.dev || renewedHandleMetadata.ino !== observed.identity.ino || renewedHandleMetadata.size !== BigInt(bytes.byteLength)) {
      throw new Error("Project lease identity changed during renewal");
    }
  } catch (error) {
    primaryError = error;
  }
  if (primaryError !== void 0 && !pendingDeadlineOperation(primaryError) && writeMayHaveChangedOwner && handle) {
    try {
      const repairBefore = await withinDeadline(
        deadline,
        "ambiguous renewal repair handle metadata",
        () => handle.stat({ bigint: true }),
        { boundary: "reconcile" }
      );
      assertSecureOwnerFileMetadata(repairBefore, path, 1n);
      if (repairBefore.dev !== observed.identity.dev || repairBefore.ino !== observed.identity.ino) {
        throw new Error("Project lease handle identity changed before ambiguous renewal repair");
      }
      const repairPathIdentity = await withinDeadline(
        deadline,
        "ambiguous renewal repair path identity",
        () => captureSecurePathIdentity(layout, path, "file"),
        { boundary: "reconcile" }
      );
      if (!sameIdentity2(repairPathIdentity, observed.identity)) {
        throw new Error("Project lease path identity changed before ambiguous renewal repair");
      }
      await withinDeadline(
        deadline,
        "ambiguous renewal repair path validation",
        () => validateSecurePathIdentity(layout, repairPathIdentity),
        { boundary: "reconcile" }
      );
      await writeExactRenewalOwner(handle, bytes, deadline, "reconcile");
      await withinDeadline(
        deadline,
        "ambiguous renewal repair truncate",
        () => handle.truncate(bytes.byteLength),
        { boundary: "reconcile" }
      );
      await withinDeadline(
        deadline,
        "ambiguous renewal repair sync",
        () => handle.sync(),
        { boundary: "reconcile" }
      );
      renewedHandleMetadata = await withinDeadline(
        deadline,
        "ambiguous renewal repaired handle metadata",
        () => handle.stat({ bigint: true }),
        { boundary: "reconcile" }
      );
      assertSecureOwnerFileMetadata(renewedHandleMetadata, path, 1n);
      if (renewedHandleMetadata.dev !== observed.identity.dev || renewedHandleMetadata.ino !== observed.identity.ino || renewedHandleMetadata.size !== BigInt(bytes.byteLength)) {
        throw new Error("Project lease identity changed during ambiguous renewal repair");
      }
    } catch (repairError) {
      primaryError = new AggregateError(
        [primaryError, repairError],
        "Project lease renewal failed and exact owner repair was ambiguous",
        { cause: primaryError }
      );
    }
  }
  let closeError;
  if (handle) {
    try {
      await mandatoryClose(handle, deadline, "renewal handle close", pendingDeadlineOperation(primaryError));
    } catch (error) {
      closeError = error;
    }
  }
  let unresolvedWork = pendingDeadlineOperation(primaryError) ?? pendingDeadlineOperation(closeError);
  if (unresolvedWork) observed.unresolvedWork = unresolvedWork;
  const errors = [];
  if (primaryError !== void 0) errors.push(primaryError);
  if (closeError !== void 0) errors.push(closeError);
  let verifiedRenewed;
  if (errors.length === 0) {
    try {
      const persisted = await optionalObservedLease(
        layout,
        path,
        observed.owner.projectDigest,
        deadline,
        "operation",
        hooks
      );
      if (!persisted || !sameIdentity2(persisted.identity, observed.identity) || !sameOwner(persisted.owner, renewed) || renewedHandleMetadata && !sameLeaseFileVersion(persisted.metadata, renewedHandleMetadata)) {
        throw new Error("Project lease persisted owner or version changed after renewal");
      }
      verifiedRenewed = persisted;
    } catch (error) {
      errors.push(error);
      unresolvedWork = pendingDeadlineOperation(error) ?? unresolvedWork;
      if (unresolvedWork) observed.unresolvedWork = unresolvedWork;
    }
  }
  if (errors.length > 0 && writeMayHaveChangedOwner && !unresolvedWork) {
    try {
      const persisted = await optionalObservedLease(
        layout,
        path,
        observed.owner.projectDigest,
        deadline,
        "reconcile",
        hooks
      );
      if (!persisted || !sameIdentity2(persisted.identity, observed.identity)) {
        throw new Error("Project lease identity changed during ambiguous renewal reconciliation");
      }
      if (sameOwner(persisted.owner, renewed)) {
        observed.owner = renewed;
        observed.metadata = persisted.metadata;
      } else if (!sameOwner(persisted.owner, observed.owner)) {
        throw new Error("Project lease owner changed during ambiguous renewal reconciliation");
      } else {
        observed.metadata = persisted.metadata;
      }
    } catch (error) {
      errors.push(error);
      unresolvedWork = pendingDeadlineOperation(error) ?? unresolvedWork;
      if (unresolvedWork) observed.unresolvedWork = unresolvedWork;
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(errors, "Project lease renewal or exact reconciliation was ambiguous", { cause: errors[0] });
  }
  if (!verifiedRenewed) throw new Error("Project lease renewed owner was not verified");
  observed.owner = verifiedRenewed.owner;
  observed.identity = verifiedRenewed.identity;
  observed.metadata = verifiedRenewed.metadata;
}
function wait(milliseconds) {
  return new Promise((accept) => setTimeout(accept, milliseconds));
}
async function retryAcquire(options, deadline, path, reason) {
  if (options.beforeAcquireRetry) {
    await withinDeadline(
      deadline,
      `${reason} retry hook`,
      () => options.beforeAcquireRetry(path, reason)
    );
  }
  const remaining = deadlineRemaining(deadline, `before ${reason} retry wait`);
  await withinDeadline(
    deadline,
    `${reason} retry wait`,
    () => options.waitForRetry(Math.min(pollingIntervalMs, remaining))
  );
}
async function acquireLease(options, deadline, path, projectDigest2) {
  for (; ; ) {
    deadlineRemaining(deadline, "before an acquisition iteration");
    deadlineRemaining(deadline, "before acquisition wall-clock sample");
    const createdAtMs = wallTime(options.now);
    deadlineRemaining(deadline, "after acquisition wall-clock sample");
    deadlineRemaining(deadline, "before acquisition nonce generation");
    const owner = {
      version: 1,
      pid: process.pid,
      nonce: randomBytes4(16).toString("hex"),
      createdAtMs,
      renewedAtMs: createdAtMs,
      leaseMs: options.leaseMs,
      projectDigest: projectDigest2
    };
    deadlineRemaining(deadline, "after acquisition nonce generation");
    deadlineRemaining(deadline, "before exclusive creation");
    const created = await createLease(options.layout, path, owner, deadline, options);
    if (created) {
      let deadlineError;
      try {
        deadlineRemaining(deadline, "after exclusive creation");
        if (options.afterLeaseCreate) {
          await withinDeadline(deadline, "post-create hook", () => options.afterLeaseCreate(path));
        }
      } catch (error) {
        deadlineError = error;
      }
      if (deadlineError !== void 0) {
        const pending = pendingDeadlineOperation(deadlineError);
        if (pending) {
          created.unresolvedWork = pending;
          throw new AggregateError(
            [
              deadlineError,
              new AmbiguousProcessLeaseCleanupError(
                "Project lease post-create work remains unresolved; preserving the exact created owner evidence"
              )
            ],
            "Project lease timed out after exclusive creation and exact release remains ambiguous",
            { cause: deadlineError }
          );
        }
        try {
          await removeObservedLease(options.layout, path, created, deadline, "reconcile", options);
        } catch (releaseError) {
          throw new AggregateError(
            [deadlineError, releaseError],
            "Project lease timed out after exclusive creation and exact release was ambiguous",
            { cause: deadlineError }
          );
        }
        throw deadlineError;
      }
      return { path, observed: created };
    }
    deadlineRemaining(deadline, "after exclusive-create conflict");
    if (options.afterCreateConflict) {
      await withinDeadline(
        deadline,
        "exclusive-create conflict hook",
        () => options.afterCreateConflict(path)
      );
    }
    let occupied;
    try {
      occupied = await withinDeadline(
        deadline,
        "conflicting lease observation",
        () => optionalObservedLease(options.layout, path, projectDigest2, deadline, "operation", options)
      );
    } catch (error) {
      if (deadlineFailure(error)) throw error;
      if (error instanceof InvalidProcessLeaseOwnerError) throw error;
      if (!(error instanceof TransientProcessLeaseObservationError) && error.code !== "ENOENT") throw error;
      try {
        await retryAcquire(options, deadline, path, "transient-observation");
      } catch (retryError) {
        if (deadlineFailure(retryError)) throw retryError;
        throw new AggregateError(
          [error, retryError],
          "Transient project lease observation and acquisition retry both failed",
          { cause: error }
        );
      }
      continue;
    }
    if (!occupied) {
      await retryAcquire(options, deadline, path, "missing-after-conflict");
      continue;
    }
    deadlineRemaining(deadline, "before observed-owner wall-clock sample");
    const currentWallTime = wallTime(options.now);
    deadlineRemaining(deadline, "after observed-owner wall-clock sample");
    if (currentWallTime < occupied.owner.renewedAtMs) {
      throw new Error("Project lease timestamp is in the future; refusing ambiguous lock state");
    }
    if (currentWallTime - occupied.owner.renewedAtMs >= occupied.owner.leaseMs) {
      deadlineRemaining(deadline, "before observed-owner liveness probe");
      const liveness = probeProcessLiveness(occupied.owner.pid);
      deadlineRemaining(deadline, "after observed-owner liveness probe");
      if (liveness === "ambiguous") {
        throw new Error("Project lease owner liveness is ambiguous; refusing stale-lock recovery");
      }
      if (liveness === "dead") {
        await withinDeadline(
          deadline,
          "dead-owner exact reclaim",
          () => removeObservedLease(options.layout, path, occupied, deadline, "operation", options)
        );
        await retryAcquire(options, deadline, path, "dead-reclaimed");
        continue;
      }
    }
    await retryAcquire(options, deadline, path, "live-owner");
  }
}
async function withLocalQueue(key, deadline, operation) {
  const normalized3 = process.platform === "win32" ? key.toLocaleLowerCase("en-US") : key;
  let state = processLeaseQueues.get(normalized3);
  if (!state) {
    state = { tail: Promise.resolve(), users: 0 };
    processLeaseQueues.set(normalized3, state);
  }
  state.users += 1;
  const predecessor = state.tail;
  let release;
  const turn = new Promise((accept) => {
    release = accept;
  });
  state.tail = predecessor.then(() => turn);
  try {
    await withinDeadline(deadline, "local queue predecessor", () => predecessor);
    deadlineRemaining(deadline, "after the local queue predecessor resolved");
    return await operation();
  } finally {
    release();
    state.users -= 1;
    if (state.users === 0 && processLeaseQueues.get(normalized3) === state) processLeaseQueues.delete(normalized3);
  }
}
async function withProcessLease(options, operation) {
  const timeoutMs = duration(options.timeoutMs, defaultTimeoutMs, "Project lease timeout");
  const leaseMs = duration(options.leaseMs, defaultLeaseMs, "Project lease duration");
  const monotonicNow = options.monotonicNow ?? (() => performance5.now());
  const normalized3 = {
    ...options,
    timeoutMs,
    leaseMs,
    monotonicNow,
    waitForRetry: options.waitForRetry ?? wait
  };
  const deadline = createDeadline(monotonicNow, timeoutMs);
  const canonicalRoot = await withinDeadline(
    deadline,
    "canonical project-root resolution",
    () => realpath5(options.projectRoot)
  );
  const digest = canonicalDigest(canonicalRoot);
  const path = lockPath(options.layout, digest);
  return withLocalQueue(path, deadline, async () => {
    deadlineRemaining(deadline, "before process-lease acquisition");
    const acquired = await acquireLease(normalized3, deadline, path, digest);
    let dispatchError;
    try {
      if (normalized3.afterAcquire) {
        await withinDeadline(
          deadline,
          "post-acquisition hook",
          () => normalized3.afterAcquire(path)
        );
      }
      const dispatchOwner = await optionalObservedLease(
        options.layout,
        acquired.path,
        acquired.observed.owner.projectDigest,
        deadline,
        "operation",
        normalized3
      );
      if (!dispatchOwner || !sameIdentity2(dispatchOwner.identity, acquired.observed.identity) || !sameOwner(dispatchOwner.owner, acquired.observed.owner) || !sameLeaseFileVersion(dispatchOwner.metadata, acquired.observed.metadata)) {
        throw new Error("Project lease ownership or version changed before callback dispatch");
      }
      acquired.observed = dispatchOwner;
      deadlineRemaining(deadline, "before project-operation callback dispatch");
    } catch (error) {
      dispatchError = error;
    }
    if (dispatchError !== void 0) {
      const pending = pendingDeadlineOperation(dispatchError) ?? acquired.observed.unresolvedWork;
      if (pending) {
        acquired.observed.unresolvedWork = pending;
        throw new AggregateError(
          [
            dispatchError,
            new AmbiguousProcessLeaseCleanupError(
              "Project lease dispatch work remains unresolved; preserving exact owner evidence"
            )
          ],
          "Project lease acquisition expired and exact release remains ambiguous",
          { cause: dispatchError }
        );
      }
      try {
        await removeObservedLease(options.layout, acquired.path, acquired.observed, deadline, "reconcile", normalized3);
      } catch (releaseError2) {
        throw new AggregateError(
          [dispatchError, releaseError2],
          "Project lease acquisition expired and exact release was ambiguous",
          { cause: dispatchError }
        );
      }
      throw dispatchError;
    }
    let renewalTimer;
    let renewalInFlight;
    let assertionInFlight;
    let renewalError;
    let stopped = false;
    const intervalMs = Math.max(10, Math.min(1e3, Math.floor(leaseMs / 3)));
    const renewalBudgetMs = Math.max(10, Math.min(intervalMs, leaseMs - intervalMs));
    const assertionBudgetMs = Math.max(10, leaseMs);
    const releaseBudgetMs = Math.max(250, leaseMs);
    const scheduleRenewal = () => {
      if (stopped || renewalError !== void 0 || acquired.observed.unresolvedWork || assertionInFlight || renewalInFlight || renewalTimer) return;
      renewalTimer = setTimeout(() => {
        renewalTimer = void 0;
        if (stopped || renewalError !== void 0 || acquired.observed.unresolvedWork || assertionInFlight) return;
        let renewalDeadline;
        try {
          renewalDeadline = createDeadline(monotonicNow, renewalBudgetMs, renewalBudgetMs);
        } catch (error) {
          renewalError = error;
          return;
        }
        renewalInFlight = renewLease(
          options.layout,
          acquired.path,
          acquired.observed,
          options.now,
          renewalDeadline,
          normalized3
        ).catch((error) => {
          const pending = pendingDeadlineOperation(error);
          if (pending) acquired.observed.unresolvedWork = pending;
          renewalError = error;
        }).finally(() => {
          renewalInFlight = void 0;
          scheduleRenewal();
        });
      }, intervalMs);
      renewalTimer.unref?.();
    };
    const performAssertOwned = async () => {
      if (renewalTimer) {
        clearTimeout(renewalTimer);
        renewalTimer = void 0;
      }
      const unresolvedBeforeAssertion = unresolvedLeaseWork(acquired.observed);
      if (unresolvedBeforeAssertion) {
        throw new AmbiguousProcessLeaseCleanupError(
          `Project lease assertion is blocked behind unresolved ${unresolvedBeforeAssertion.context}`
        );
      }
      const assertionDeadline = createDeadline(monotonicNow, assertionBudgetMs, assertionBudgetMs);
      if (renewalInFlight) {
        try {
          await withinDeadline(
            assertionDeadline,
            "in-flight renewal join",
            () => renewalInFlight
          );
        } catch (error) {
          const pending = pendingDeadlineOperation(error);
          if (pending) acquired.observed.unresolvedWork = pending;
          throw error;
        }
      }
      const unresolvedAfterJoin = unresolvedLeaseWork(acquired.observed);
      if (unresolvedAfterJoin) {
        throw new AmbiguousProcessLeaseCleanupError(
          `Project lease assertion is blocked behind unresolved ${unresolvedAfterJoin.context}`
        );
      }
      if (renewalError !== void 0) throw renewalError;
      let current;
      try {
        current = await optionalObservedLease(
          options.layout,
          acquired.path,
          acquired.observed.owner.projectDigest,
          assertionDeadline,
          "operation",
          normalized3
        );
      } catch (error) {
        const pending = pendingDeadlineOperation(error);
        if (pending) acquired.observed.unresolvedWork = pending;
        throw error;
      }
      if (!current || !sameIdentity2(current.identity, acquired.observed.identity) || !sameOwner(current.owner, acquired.observed.owner) || !sameLeaseFileVersion(current.metadata, acquired.observed.metadata)) {
        throw new Error("Project lease ownership or identity changed");
      }
    };
    const assertOwned = () => {
      if (assertionInFlight) return assertionInFlight;
      let currentAssertion;
      currentAssertion = performAssertOwned().finally(() => {
        if (assertionInFlight === currentAssertion) assertionInFlight = void 0;
        scheduleRenewal();
      });
      assertionInFlight = currentAssertion;
      return currentAssertion;
    };
    const lease = {
      get pid() {
        return acquired.observed.owner.pid;
      },
      get nonce() {
        return acquired.observed.owner.nonce;
      },
      get createdAtMs() {
        return acquired.observed.owner.createdAtMs;
      },
      get renewedAtMs() {
        return acquired.observed.owner.renewedAtMs;
      },
      get leaseMs() {
        return acquired.observed.owner.leaseMs;
      },
      get projectDigest() {
        return acquired.observed.owner.projectDigest;
      },
      get lockIdentity() {
        return acquired.observed.identity;
      },
      assertOwned
    };
    scheduleRenewal();
    let result;
    let operationError;
    try {
      result = await operation(lease);
      await assertOwned();
    } catch (error) {
      const pending = pendingDeadlineOperation(error);
      if (pending) acquired.observed.unresolvedWork = pending;
      operationError = error;
    }
    stopped = true;
    if (renewalTimer) {
      clearTimeout(renewalTimer);
      renewalTimer = void 0;
    }
    if (renewalInFlight) {
      try {
        const shutdownDeadline = createDeadline(monotonicNow, assertionBudgetMs, assertionBudgetMs);
        await withinDeadline(shutdownDeadline, "renewal shutdown join", () => renewalInFlight);
      } catch (error) {
        const pending = pendingDeadlineOperation(error);
        if (pending) acquired.observed.unresolvedWork = pending;
        renewalError = renewalError === void 0 ? error : new AggregateError([renewalError, error], "Project lease renewal shutdown was ambiguous", { cause: renewalError });
      }
    }
    let releaseError;
    if (acquired.observed.unresolvedWork) {
      releaseError = new AmbiguousProcessLeaseCleanupError(
        `Project lease cleanup was suppressed behind unresolved ${acquired.observed.unresolvedWork.context}; preserving exact owner evidence`
      );
    } else {
      try {
        const releaseDeadline = createDeadline(monotonicNow, releaseBudgetMs, releaseBudgetMs);
        await removeObservedLease(
          options.layout,
          acquired.path,
          acquired.observed,
          releaseDeadline,
          "operation",
          normalized3
        );
      } catch (error) {
        releaseError = error;
      }
    }
    const completionErrors = [];
    if (operationError !== void 0) completionErrors.push(operationError);
    if (renewalError !== void 0 && renewalError !== operationError) completionErrors.push(renewalError);
    if (releaseError !== void 0) completionErrors.push(releaseError);
    if (completionErrors.length === 1) throw completionErrors[0];
    if (completionErrors.length > 1) {
      throw new AggregateError(
        completionErrors,
        "Project lease operation, renewal, or cleanup was incomplete",
        { cause: operationError ?? renewalError ?? releaseError }
      );
    }
    return result;
  });
}

// src/knowledge/redundancy.ts
import { createHash as createHash6, createHmac as createHmac3, randomBytes as randomBytes5, timingSafeEqual as timingSafeEqual3 } from "node:crypto";
import { lstat as lstat7, open as open7, realpath as realpath6 } from "node:fs/promises";
import { isAbsolute as isAbsolute4, relative as relative4, resolve as resolve6, sep as sep4 } from "node:path";
import { performance as performance6 } from "node:perf_hooks";
import { TextDecoder as TextDecoder4 } from "node:util";
var analysisSigningKey = randomBytes5(32);
function hash(value) {
  return `sha256:${createHash6("sha256").update(value).digest("hex")}`;
}
function inside(root, target) {
  const difference = relative4(root, target);
  return difference === "" || !difference.startsWith(`..${sep4}`) && difference !== ".." && !isAbsolute4(difference);
}
var RedundancyReadLimitError = class extends Error {
};
function readBudget(limits, io = {}) {
  const startedAt = performance6.now();
  return {
    bytes: new ByteBudget("Redundancy aggregate bytes", limits.scan.maxAggregateBytes),
    files: new CounterBudget("Redundancy source files", limits.scan.maxFiles),
    deadline: new DeadlineBudget("Redundancy source read", limits.scan.deadlineMs),
    deadlineAt: startedAt + limits.scan.deadlineMs,
    maxFiles: limits.scan.maxFiles,
    maxFileBytes: limits.scan.maxFileBytes,
    ...io?.beforeRepositoryContentRead ? { beforeRepositoryContentRead: io.beforeRepositoryContentRead } : {}
  };
}
function consumeReadBudget(budget, size) {
  try {
    budget.deadline.check();
    if (size === void 0) budget.files.consume();
    else budget.bytes.consume(size);
  } catch (error) {
    throw new RedundancyReadLimitError(error instanceof Error ? error.message : "Redundancy read limit exceeded");
  }
}
function checkReadDeadline(budget) {
  try {
    budget.deadline.check();
  } catch (error) {
    throw new RedundancyReadLimitError(error instanceof Error ? error.message : "Redundancy read deadline exceeded");
  }
}
function remainingReadDeadlineMs(budget) {
  checkReadDeadline(budget);
  const remaining = Math.ceil(budget.deadlineAt - performance6.now());
  if (remaining <= 0) checkReadDeadline(budget);
  return Math.max(1, remaining);
}
async function runBeforeRepositoryContentReadHook(budget, path) {
  const hook = budget.beforeRepositoryContentRead;
  if (!hook) return;
  let timer;
  try {
    await Promise.race([
      hook(path),
      new Promise((_accept, reject) => {
        timer = setTimeout(
          () => reject(new RedundancyReadLimitError("Redundancy repository content hook deadline exceeded")),
          remainingReadDeadlineMs(budget)
        );
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  checkReadDeadline(budget);
}
function sameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.gid === right.gid && left.mode === right.mode && left.nlink === right.nlink && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs && left.isFile() && right.isFile() && !left.isSymbolicLink() && !right.isSymbolicLink();
}
async function readBoundedRepositoryFile(root, repositoryPath3, budget, label, collectBytes) {
  consumeReadBudget(budget);
  const lexical = resolve6(root, ...repositoryPath3.split("/"));
  const metadata = await lstat7(lexical, { bigint: true });
  if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error(`${label} must be a regular file`);
  if (metadata.size > BigInt(budget.maxFileBytes)) {
    throw new RedundancyReadLimitError(`${label} exceeds the file byte limit of ${budget.maxFileBytes} bytes`);
  }
  const size = Number(metadata.size);
  if (!Number.isSafeInteger(size) || size < 0) throw new Error(`${label} has an invalid byte length`);
  consumeReadBudget(budget, size);
  const canonical2 = await realpath6(lexical);
  if (!inside(root, canonical2) || canonical2 !== lexical) throw new Error(`${label} resolves outside the repository`);
  checkReadDeadline(budget);
  await runBeforeRepositoryContentReadHook(budget, lexical);
  const handle = await open7(canonical2, "r");
  try {
    const opened = await handle.stat({ bigint: true });
    if (!sameFileIdentity(metadata, opened) || opened.size !== metadata.size) {
      throw new Error(`${label} identity or byte length changed before bounded read`);
    }
    checkReadDeadline(budget);
    const digest = createHash6("sha256");
    let bytes;
    let offset = 0;
    if (collectBytes) {
      bytes = Buffer.allocUnsafe(size);
      while (offset < size) {
        checkReadDeadline(budget);
        const length = Math.min(64 * 1024, size - offset);
        const result = await handle.read(bytes, offset, length, offset);
        if (result.bytesRead === 0) throw new Error(`${label} ended during bounded read`);
        digest.update(bytes.subarray(offset, offset + result.bytesRead));
        offset += result.bytesRead;
      }
    } else if (size > 0) {
      const stream = handle.createReadStream({ autoClose: false, highWaterMark: 64 * 1024, start: 0, end: size - 1 });
      for await (const value of stream) {
        checkReadDeadline(budget);
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        offset += chunk.byteLength;
        if (offset > size) {
          stream.destroy();
          throw new Error(`${label} exceeded its validated byte length during bounded read`);
        }
        digest.update(chunk);
      }
    }
    if (offset !== size) throw new Error(`${label} ended during bounded read`);
    const overflow = Buffer.allocUnsafe(1);
    if ((await handle.read(overflow, 0, 1, size)).bytesRead !== 0) {
      throw new Error(`${label} exceeded its validated byte length during bounded read`);
    }
    const [finalPath, finalCanonical, finalHandle] = await Promise.all([
      lstat7(lexical, { bigint: true }),
      realpath6(lexical),
      handle.stat({ bigint: true })
    ]);
    if (!sameFileIdentity(metadata, finalPath) || !sameFileIdentity(metadata, finalHandle) || finalPath.size !== metadata.size || finalHandle.size !== metadata.size || finalCanonical !== canonical2) {
      throw new Error(`${label} identity or byte length changed during bounded read`);
    }
    checkReadDeadline(budget);
    return { ...bytes ? { bytes } : {}, digest: `sha256:${digest.digest("hex")}` };
  } finally {
    await handle.close();
  }
}
async function manifest(rootInput, budget) {
  checkReadDeadline(budget);
  const root = await realpath6(resolve6(rootInput));
  checkReadDeadline(budget);
  const result = await readBoundedRepositoryFile(
    root,
    "docs/project-design/manifest.json",
    budget,
    "The Keeper manifest",
    true
  );
  const bytes = result.bytes;
  const value = JSON.parse(new TextDecoder4("utf-8", { fatal: true }).decode(bytes));
  checkReadDeadline(budget);
  if (value.managedBy !== "project-design-keeper") throw new Error("The manifest is not Keeper-owned");
  return { root, bytes, value };
}
function normalized(value) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[\p{P}\p{S}\s]+/gu, "");
}
var maximumTrigramBandsPerRecord = 4096;
function trigrams(value) {
  const text = normalized(value);
  if (text.length < 3) return new Set(text ? [text] : []);
  const values = /* @__PURE__ */ new Set();
  for (let index2 = 0; index2 <= text.length - 3; index2 += 1) {
    values.add(text.slice(index2, index2 + 3));
    if (values.size > maximumTrigramBandsPerRecord) {
      throw new RedundancyReadLimitError(
        `Redundancy trigram bands exceed the limit of ${maximumTrigramBandsPerRecord} per record`
      );
    }
  }
  return values;
}
function jaccard(left, right) {
  const intersection = [...left].filter((value) => right.has(value)).length;
  const union = (/* @__PURE__ */ new Set([...left, ...right])).size;
  return union === 0 ? 0 : intersection / union;
}
function strings(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  return typeof value === "string" ? [value] : [];
}
function evidenceKeys(record) {
  if (!Array.isArray(record.evidence)) return /* @__PURE__ */ new Set();
  return new Set(record.evidence.map((evidence) => {
    if (typeof evidence === "string") return evidence.toLocaleLowerCase("en-US");
    if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return "";
    const typed = evidence;
    return `${String(typed.path).toLocaleLowerCase("en-US")}:${String(typed.startLine)}:${String(typed.endLine ?? typed.startLine)}`;
  }).filter(Boolean));
}
function evidencePaths(record) {
  if (!Array.isArray(record.evidence)) return [];
  return record.evidence.flatMap((evidence) => {
    if (typeof evidence === "string") return [/^(.*):[0-9]+$/u.exec(evidence)?.[1]].filter((value) => Boolean(value));
    if (evidence && typeof evidence === "object" && !Array.isArray(evidence) && typeof evidence.path === "string") {
      return [evidence.path];
    }
    return [];
  });
}
async function sourceState(root, revisions, budget) {
  const states = [];
  const paths = Object.keys(revisions);
  if (paths.length > budget.maxFiles) {
    throw new RedundancyReadLimitError(`Redundancy source revisions exceed the limit of ${budget.maxFiles} items`);
  }
  checkReadDeadline(budget);
  paths.sort((left, right) => left.localeCompare(right, "en-US"));
  checkReadDeadline(budget);
  for (const path of paths) {
    checkReadDeadline(budget);
    const expected = revisions[path];
    if (typeof expected !== "string" || !safeRepositoryPath(path)) {
      states.push({ path, state: "invalid", fresh: false });
      continue;
    }
    try {
      const actual = (await readBoundedRepositoryFile(root, path, budget, `Redundancy source ${path}`, false)).digest;
      states.push({ path, state: actual, fresh: actual === expected });
    } catch (error) {
      if (error instanceof RedundancyReadLimitError) throw error;
      states.push({ path, state: "missing", fresh: false });
    }
  }
  return {
    freshPaths: new Set(states.filter((state) => state.fresh).map((state) => state.path.toLocaleLowerCase("en-US"))),
    digest: hash(states.map((state) => `${state.path}\0${state.state}`).join("\n"))
  };
}
function effectiveAssessment(record, freshPaths) {
  const evidence = Array.isArray(record.evidence) ? record.evidence.filter((value) => {
    if (typeof value === "string") return freshPaths.has((/^(.*):[0-9]+$/u.exec(value)?.[1] ?? "").toLocaleLowerCase("en-US"));
    return Boolean(value) && typeof value === "object" && !Array.isArray(value) && freshPaths.has(String(value.path).toLocaleLowerCase("en-US"));
  }) : [];
  return assessRecord({
    id: String(record.id),
    kind: typeof record.kind === "string" ? record.kind : void 0,
    approval: typeof record.approval === "string" ? record.approval : void 0,
    assertedConfidence: record.assertedConfidence === "high" || record.assertedConfidence === "medium" || record.assertedConfidence === "low" ? record.assertedConfidence : "low",
    evidence
  });
}
function overlaps(left, right) {
  return [...left].some((value) => right.has(value));
}
function contentDigest(record) {
  return hash(JSON.stringify(record));
}
function signature(payload) {
  return createHmac3("sha256", analysisSigningKey).update(payload, "utf8").digest();
}
function encodeAnalysis(payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signature(body).toString("base64url")}`;
}
function decodeAnalysis(analysisId) {
  const [body, encodedSignature, ...extra] = analysisId.split(".");
  if (!body || !encodedSignature || extra.length > 0) throw new Error("Redundancy analysis ID is malformed or tampered");
  let supplied;
  try {
    supplied = Buffer.from(encodedSignature, "base64url");
  } catch {
    throw new Error("Redundancy analysis ID is malformed or tampered");
  }
  const expected = signature(body);
  if (supplied.length !== expected.length || !timingSafeEqual3(supplied, expected)) {
    throw new Error("Redundancy analysis ID is malformed or tampered");
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.version !== 1 || typeof payload.root !== "string" || typeof payload.snapshotId !== "string" || !Number.isSafeInteger(payload.createdAt) || !Number.isSafeInteger(payload.expiresAt) || !Array.isArray(payload.candidates)) {
      throw new Error("invalid payload");
    }
    return payload;
  } catch {
    throw new Error("Redundancy analysis ID is malformed or tampered");
  }
}
function activeRecords(pack) {
  return Array.isArray(pack.records) ? pack.records.filter((record) => Boolean(record) && typeof record === "object" && !Array.isArray(record)) : [];
}
async function validateRedundancyDecisions(input) {
  const budget = readBudget(resolveKeeperLimits());
  const loaded = await manifest(input.root, budget);
  const payload = decodeAnalysis(input.analysisId);
  if (payload.root !== loaded.root) throw new Error("Redundancy analysis belongs to a different project");
  if ((input.now ?? Date.now)() > payload.expiresAt) throw new Error("Redundancy analysis has expired");
  const loadedRevision = loaded.value.sourceRevision && typeof loaded.value.sourceRevision === "object" && !Array.isArray(loaded.value.sourceRevision) ? loaded.value.sourceRevision.files : void 0;
  const loadedRevisions = loadedRevision && typeof loadedRevision === "object" && !Array.isArray(loadedRevision) ? loadedRevision : {};
  const loadedSources = await sourceState(loaded.root, loadedRevisions, budget);
  if (payload.snapshotId !== hash(`${hash(loaded.bytes)}\0${loadedSources.digest}`)) throw new Error("Redundancy analysis is stale for the current knowledge snapshot");
  let candidateFreshPaths;
  if (!input.candidateRecordAssessments) {
    const candidateRevision = input.candidatePack.sourceRevision && typeof input.candidatePack.sourceRevision === "object" && !Array.isArray(input.candidatePack.sourceRevision) ? input.candidatePack.sourceRevision.files : void 0;
    const candidateRevisions = candidateRevision && typeof candidateRevision === "object" && !Array.isArray(candidateRevision) ? candidateRevision : {};
    candidateFreshPaths = (await sourceState(loaded.root, candidateRevisions, budget)).freshPaths;
  }
  const candidates = new Map(payload.candidates.map((candidate) => [candidate.candidateId, candidate]));
  const seen = /* @__PURE__ */ new Set();
  const records = new Map(activeRecords(input.candidatePack).map((record) => [String(record.id), record]));
  const currentRecords = new Map(activeRecords(loaded.value).map((record) => [String(record.id), record]));
  const exceptions = Array.isArray(input.candidatePack.dedupeExceptions) ? input.candidatePack.dedupeExceptions.filter((value) => Boolean(value) && typeof value === "object" && !Array.isArray(value)) : [];
  for (const decision of input.decisions) {
    if (seen.has(decision.candidateId)) throw new Error(`Redundancy candidate decision is duplicated: ${decision.candidateId}`);
    seen.add(decision.candidateId);
    const candidate = candidates.get(decision.candidateId);
    if (!candidate) throw new Error(`Redundancy candidate does not belong to this analysis: ${decision.candidateId}`);
    candidate.recordIds.forEach((id, index2) => {
      const current = currentRecords.get(id);
      if (!current || contentDigest(current) !== candidate.recordDigests[index2]) {
        throw new Error(`Redundancy candidate record digest is stale or tampered: ${id}`);
      }
    });
    if (decision.decision === "defer") continue;
    if (decision.decision === "keep-separate") {
      const [leftId, rightId] = candidate.recordIds;
      const [leftDigest, rightDigest] = candidate.recordDigests;
      const kept = exceptions.some(
        (exception) => exception.leftId === leftId && exception.rightId === rightId && exception.leftDigest === leftDigest && exception.rightDigest === rightDigest || exception.leftId === rightId && exception.rightId === leftId && exception.leftDigest === rightDigest && exception.rightDigest === leftDigest
      );
      if (!kept) throw new Error(`Candidate pack is missing the confirmed keep-separate exception: ${decision.candidateId}`);
      continue;
    }
    const survivorId = decision.survivorId ?? candidate.recommendedSurvivorId;
    if (!candidate.recordIds.includes(survivorId)) throw new Error(`Merge survivor is not part of candidate: ${decision.candidateId}`);
    const loserId = candidate.recordIds.find((id) => id !== survivorId);
    const survivor = records.get(survivorId);
    const loser = records.get(loserId);
    const originalSurvivor = currentRecords.get(survivorId);
    const lifecycle = loser?.lifecycle;
    if (!survivor || !loser || lifecycle?.state !== "terminal" || lifecycle.reason !== "merged" || !strings(lifecycle.successorIds).includes(survivorId)) {
      throw new Error(`Candidate pack does not encode the confirmed merge relationship: ${decision.candidateId}`);
    }
    const ranks = {
      strength: { pending: 0, informational: 1, preferred: 2, required: 3 },
      approval: { pending: 0, "not-required": 1, confirmed: 2 },
      assertedConfidence: { low: 0, medium: 1, high: 2 }
    };
    for (const field of ["strength", "approval", "assertedConfidence"]) {
      const before = ranks[field][String(originalSurvivor[field])] ?? -1;
      const after = ranks[field][String(survivor[field])] ?? -1;
      if (after > before) throw new Error(`Redundancy merge cannot promote survivor ${field}: ${survivorId}`);
    }
    const confidenceRank2 = { low: 0, medium: 1, high: 2 };
    const beforeEffective = effectiveAssessment(originalSurvivor, loadedSources.freshPaths).effectiveConfidence;
    const validatedAssessment = input.candidateRecordAssessments?.find((assessment) => assessment.id === survivorId);
    if (input.candidateRecordAssessments && !validatedAssessment) {
      throw new Error(`Validated candidate assessment is missing for merge survivor: ${survivorId}`);
    }
    const afterEffective = validatedAssessment?.effectiveConfidence ?? effectiveAssessment(survivor, candidateFreshPaths).effectiveConfidence;
    if (confidenceRank2[afterEffective] > confidenceRank2[beforeEffective]) {
      throw new Error(`Redundancy merge cannot promote survivor effective confidence: ${survivorId}`);
    }
  }
}
function survivorScore(record, index2, freshPaths) {
  const normative = record.approval === "confirmed" && (record.strength === "required" || record.strength === "preferred") ? 1 : 0;
  const assessed = effectiveAssessment(record, freshPaths);
  const confidence = assessed.effectiveConfidence === "high" ? 2 : assessed.effectiveConfidence === "medium" ? 1 : 0;
  const evidence = Array.isArray(record.evidence) ? record.evidence.length : 0;
  const freshEvidence = evidencePaths(record).filter((path) => freshPaths.has(path.toLocaleLowerCase("en-US"))).length;
  return [normative, confidence, freshEvidence, evidence, -index2, String(record.id)];
}
function compareScores(left, right) {
  for (let index2 = 0; index2 < 5; index2 += 1) {
    if (left[index2] !== right[index2]) return Number(right[index2]) - Number(left[index2]);
  }
  return String(left[5]).localeCompare(String(right[5]), "en-US");
}
function selected(record, input) {
  const query = typeof input.query === "string" ? input.query.normalize("NFKC").toLocaleLowerCase("en-US") : "";
  if (query && !JSON.stringify(record).normalize("NFKC").toLocaleLowerCase("en-US").includes(query)) return false;
  const paths = strings(input.paths);
  const evidenceText = JSON.stringify(record.evidence ?? []).toLocaleLowerCase("en-US");
  if (paths.length > 0 && !paths.some((path) => evidenceText.includes(path.toLocaleLowerCase("en-US")))) return false;
  const modules = strings(input.modules);
  if (modules.length > 0 && !modules.some((module) => `${String(record.scope)} ${strings(record.modules).join(" ")}`.toLocaleLowerCase("en-US").includes(module.toLocaleLowerCase("en-US")))) return false;
  return true;
}
function redundancyBucketKeys(indexed) {
  const record = indexed.record;
  const kind = normalized(String(record.kind ?? ""));
  const owner = normalized(String(record.ownerDocument ?? ""));
  const scope = normalized(String(record.scope ?? ""));
  const structuralKey = [kind || "<missing>", owner || "<missing>", scope || "<missing>"].join("\0");
  const keys = [
    ...[...indexed.trigrams].map((trigram) => `trigram-band:${trigram}`),
    ...[...indexed.evidence].map((evidence) => `evidence:${evidence}`),
    ...[...indexed.impacts].map((impact) => `kind-owner-scope-impact:${structuralKey}\0${impact}`)
  ];
  return [...new Set(keys)].sort((left, right) => left.localeCompare(right, "en-US"));
}
function boundedCandidatePairs(records, maximumPairs, budget) {
  const buckets = /* @__PURE__ */ new Map();
  const membershipWork = new CounterBudget(
    "Redundancy bucket membership work",
    Math.max(1024, maximumPairs * 64)
  );
  for (const indexed of records) {
    checkReadDeadline(budget);
    for (const key of redundancyBucketKeys(indexed)) {
      membershipWork.consume();
      const members = buckets.get(key) ?? [];
      members.push(indexed.index);
      buckets.set(key, members);
    }
  }
  const pairs = /* @__PURE__ */ new Map();
  const pairWork = new CounterBudget("Redundancy candidate pair work", Math.max(1024, maximumPairs * 64));
  for (const key of [...buckets.keys()].sort((left, right) => left.localeCompare(right, "en-US"))) {
    checkReadDeadline(budget);
    const members = buckets.get(key).sort((left, right) => left - right);
    for (let left = 0; left < members.length; left += 1) {
      for (let right = left + 1; right < members.length; right += 1) {
        pairWork.consume();
        checkReadDeadline(budget);
        const leftIndex = members[left];
        const rightIndex = members[right];
        const pairKey = `${leftIndex}:${rightIndex}`;
        if (pairs.has(pairKey)) continue;
        pairs.set(pairKey, [leftIndex, rightIndex]);
        if (pairs.size > maximumPairs) {
          throw new Error(`Redundancy candidate pairs exceed the limit of ${maximumPairs}; narrow the analysis scope`);
        }
      }
    }
  }
  return [...pairs.values()].sort(([leftA, rightA], [leftB, rightB]) => leftA - leftB || rightA - rightB);
}
function recordPairKey(leftId, rightId) {
  return JSON.stringify(leftId <= rightId ? [leftId, rightId] : [rightId, leftId]);
}
function exceptionBindingKey(leftId, rightId, leftDigest, rightDigest) {
  return leftId <= rightId ? JSON.stringify([leftId, rightId, leftDigest, rightDigest]) : JSON.stringify([rightId, leftId, rightDigest, leftDigest]);
}
async function analyzeRedundancy(input, options = {}) {
  if (typeof input.root !== "string") throw new Error("A repository root is required");
  const resolvedLimits = resolveKeeperLimits(options.limits);
  const budget = readBudget(resolvedLimits, options.redundancyIo);
  const loaded = await manifest(input.root, budget);
  const limits = resolvedLimits.redundancy;
  const rawRecords = Array.isArray(loaded.value.records) ? loaded.value.records : [];
  if (rawRecords.length > limits.maxRecords) {
    throw new Error(`Redundancy records exceed the limit of ${limits.maxRecords}; narrow the analysis scope`);
  }
  const records = [];
  const recordIds = /* @__PURE__ */ new Set();
  for (const value of rawRecords) {
    checkReadDeadline(budget);
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const record = value;
    if (typeof record.id !== "string" || record.id.length === 0) {
      throw new Error("Redundancy record ID must be a non-empty string");
    }
    if (recordIds.has(record.id)) throw new Error(`Redundancy record ID is duplicated: ${record.id}`);
    recordIds.add(record.id);
    if (selected(record, input)) records.push(record);
  }
  const rawExceptions = Array.isArray(loaded.value.dedupeExceptions) ? loaded.value.dedupeExceptions : [];
  if (rawExceptions.length > limits.maxPairs) {
    throw new Error(`Redundancy exceptions exceed the limit of ${limits.maxPairs}; narrow the analysis scope`);
  }
  const exceptionPairs = /* @__PURE__ */ new Set();
  const exactExceptions = /* @__PURE__ */ new Set();
  for (const value of rawExceptions) {
    checkReadDeadline(budget);
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const exception = value;
    if (typeof exception.leftId !== "string" || typeof exception.rightId !== "string") continue;
    exceptionPairs.add(recordPairKey(exception.leftId, exception.rightId));
    if (typeof exception.leftDigest === "string" && typeof exception.rightDigest === "string") {
      exactExceptions.add(exceptionBindingKey(
        exception.leftId,
        exception.rightId,
        exception.leftDigest,
        exception.rightDigest
      ));
    }
  }
  const revision = loaded.value.sourceRevision && typeof loaded.value.sourceRevision === "object" && !Array.isArray(loaded.value.sourceRevision) ? loaded.value.sourceRevision.files : void 0;
  const revisions = revision && typeof revision === "object" && !Array.isArray(revision) ? revision : {};
  const sources = await sourceState(loaded.root, revisions, budget);
  const candidates = [];
  let invalidatedExceptionCount = 0;
  const indexedRecords = [];
  for (const [index2, record] of records.entries()) {
    checkReadDeadline(budget);
    if (record.lifecycle?.state === "terminal") continue;
    if (Array.isArray(record.evidence) && record.evidence.length > resolvedLimits.pack.maxEvidencePerRecord) {
      throw new RedundancyReadLimitError(
        `Redundancy record evidence exceeds the limit of ${resolvedLimits.pack.maxEvidencePerRecord} items`
      );
    }
    if (Array.isArray(record.impact) && record.impact.length > resolvedLimits.pack.maxImpactPerRecord) {
      throw new RedundancyReadLimitError(
        `Redundancy record impact exceeds the limit of ${resolvedLimits.pack.maxImpactPerRecord} items`
      );
    }
    const digest = contentDigest(record);
    options.redundancyIo?.onRecordDigest?.(String(record.id));
    indexedRecords.push({
      record,
      index: index2,
      digest,
      trigrams: trigrams(String(record.statement ?? "")),
      evidence: evidenceKeys(record),
      impacts: new Set(strings(record.impact).map(normalized))
    });
    checkReadDeadline(budget);
  }
  const byIndex = new Map(indexedRecords.map((indexed) => [indexed.index, indexed]));
  for (const [leftIndex, rightIndex] of boundedCandidatePairs(indexedRecords, limits.maxPairs, budget)) {
    checkReadDeadline(budget);
    const leftIndexed = byIndex.get(leftIndex);
    const rightIndexed = byIndex.get(rightIndex);
    const left = leftIndexed.record;
    const right = rightIndexed.record;
    const similarity = jaccard(leftIndexed.trigrams, rightIndexed.trigrams);
    checkReadDeadline(budget);
    const evidenceOverlap = overlaps(leftIndexed.evidence, rightIndexed.evidence);
    const impactOverlap = overlaps(leftIndexed.impacts, rightIndexed.impacts);
    const sameKind = left.kind === right.kind;
    const sameScope = left.scope === right.scope;
    const sameOwner2 = left.ownerDocument === right.ownerDocument;
    const related = similarity >= 0.32 || evidenceOverlap || impactOverlap && sameKind && sameScope && sameOwner2;
    if (!related) continue;
    const pairKey = recordPairKey(String(left.id), String(right.id));
    if (exactExceptions.has(exceptionBindingKey(
      String(left.id),
      String(right.id),
      leftIndexed.digest,
      rightIndexed.digest
    ))) continue;
    if (exceptionPairs.has(pairKey)) invalidatedExceptionCount += 1;
    const ranked = [
      { record: left, index: leftIndex, score: survivorScore(left, leftIndex, sources.freshPaths) },
      { record: right, index: rightIndex, score: survivorScore(right, rightIndex, sources.freshPaths) }
    ].sort((a, b) => compareScores(a.score, b.score));
    const reasons = [
      ...similarity >= 0.32 ? [`character-trigram:${similarity.toFixed(3)}`] : [],
      ...evidenceOverlap ? ["evidence-overlap"] : [],
      ...impactOverlap ? ["impact-overlap"] : [],
      ...sameKind ? ["same-kind"] : [],
      ...sameScope ? ["same-scope"] : [],
      ...sameOwner2 ? ["same-owner"] : []
    ];
    candidates.push({
      candidateId: hash(recordPairKey(String(left.id), String(right.id))),
      recordIds: [String(left.id), String(right.id)],
      recommendedSurvivorId: String(ranked[0].record.id),
      reasons,
      decision: null
    });
  }
  const createdAt = (options.now ?? Date.now)();
  const expiresAt = createdAt + 30 * 60 * 1e3;
  const snapshotId = hash(`${hash(loaded.bytes)}\0${sources.digest}`);
  const recordsById = new Map(indexedRecords.map((indexed) => [String(indexed.record.id), indexed]));
  const tokenCandidates = candidates.map((candidate) => {
    const recordIds2 = candidate.recordIds;
    const left = recordsById.get(recordIds2[0]);
    const right = recordsById.get(recordIds2[1]);
    return {
      candidateId: String(candidate.candidateId),
      recordIds: recordIds2,
      recordDigests: [left.digest, right.digest],
      recommendedSurvivorId: String(candidate.recommendedSurvivorId)
    };
  });
  const analysisPayload = { version: 1, root: loaded.root, snapshotId, createdAt, expiresAt, candidates: tokenCandidates };
  const analysisId = encodeAnalysis(analysisPayload);
  const result = {
    schemaVersion: 3,
    snapshotId,
    analysisId,
    createdAt: new Date(createdAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    candidates,
    invalidatedExceptionCount
  };
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > 1024 * 1024) throw new Error("Redundancy analysis exceeds the one MiB response budget");
  return result;
}

// src/knowledge/archive.ts
var archiveTimestampWindowMs = 5 * 60 * 1e3;
function objects(value) {
  return Array.isArray(value) ? value.filter((item) => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}
function archive(pack) {
  return pack.archive && typeof pack.archive === "object" && !Array.isArray(pack.archive) ? pack.archive : {};
}
function generations(pack) {
  return objects(archive(pack).generations);
}
function tombstonePath(pack) {
  const tombstones = archive(pack).tombstones;
  return tombstones && typeof tombstones === "object" && !Array.isArray(tombstones) && typeof tombstones.path === "string" ? tombstones.path : void 0;
}
function tombstoneCount(pack) {
  const tombstones = archive(pack).tombstones;
  return tombstones && typeof tombstones === "object" && !Array.isArray(tombstones) ? tombstones.count : void 0;
}
async function jsonLines2(path, expectedCount, read) {
  if (!path) {
    if (expectedCount === void 0 || expectedCount === 0) return [];
    throw new Error("Archive JSONL path is missing");
  }
  const bytes = await read(path);
  if (!bytes) {
    if (expectedCount === 0) return [];
    throw new Error(`Archive JSONL source is missing: ${path}`);
  }
  return decodeCanonicalJsonLines(bytes, `Archive history ${path}`, { expectedCount }).map(({ value, line }) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Archive history ${path}:${line} is not an object`);
    }
    return value;
  });
}
async function strictArchiveEntries(path, expectedCount, read) {
  if (!path) {
    return { entries: [], issues: [{ code: "archive_generation_source_missing", path: "archive.generations", message: "Dropped archive generation has no readable source path" }] };
  }
  const bytes = await read(path);
  if (!bytes) {
    return { entries: [], issues: [{ code: "archive_generation_source_missing", path, message: "Dropped archive generation source is missing" }] };
  }
  const issues = [];
  let lines;
  try {
    lines = decodeCanonicalJsonLines(bytes, `Dropped archive generation ${path}`, { expectedCount });
  } catch (error) {
    return {
      entries: [],
      issues: [{
        code: error instanceof CanonicalJsonLinesError && error.kind === "count" ? "archive_generation_record_count_mismatch" : "archive_generation_source_invalid",
        path,
        message: error instanceof Error ? error.message : "Dropped archive generation JSONL is invalid"
      }]
    };
  }
  const entries = [];
  for (const { value, line } of lines) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      issues.push({ code: "archive_generation_source_invalid", path: `${path}:${line}`, message: "Dropped archive generation contains non-object JSONL history" });
      continue;
    }
    if (!isCompleteArchiveEntry(value)) {
      issues.push({ code: "archive_generation_entry_invalid", path: `${path}:${line}`, message: "Dropped archive generation must contain complete and internally consistent Schema 3.0 archive entries" });
      continue;
    }
    entries.push(value);
  }
  return { entries, issues };
}
function terminalEligible(record) {
  const lifecycle = record?.lifecycle;
  return Boolean(lifecycle && typeof lifecycle === "object" && !Array.isArray(lifecycle) && lifecycle.state === "terminal" && Number(lifecycle.confirmedRefreshes) >= 2);
}
function tombstoneFor(entry) {
  const record = entry.record;
  const lifecycle = record?.lifecycle;
  if (!record || typeof record.id !== "string" || !lifecycle || typeof lifecycle !== "object" || Array.isArray(lifecycle) || typeof entry.contentHash !== "string" || typeof entry.archivedAt !== "string") return void 0;
  return {
    id: record.id,
    reason: lifecycle.reason ?? entry.terminalReason,
    successorIds: Array.isArray(lifecycle.successorIds) ? lifecycle.successorIds : [],
    contentHash: entry.contentHash,
    archivedAt: entry.archivedAt
  };
}
function equalJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function managedBody(contents, recordId) {
  if (!contents) return void 0;
  const escaped = recordId.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = new RegExp(`<!-- project-design-keeper:managed record-id="${escaped}" content-hash="sha256:[a-f0-9]{64}" -->([\\s\\S]*?)<!-- \\/project-design-keeper:managed -->`, "u").exec(contents.toString("utf8"));
  return match?.[1];
}
async function validateArchiveTransition(input) {
  const { currentPack, candidatePack } = input;
  if (currentPack.schemaVersion !== "3.0" || candidatePack.schemaVersion !== "3.0") return [];
  const issues = [];
  if (Number(candidatePack.maintenanceRevision) !== Number(currentPack.maintenanceRevision) + 1) {
    issues.push({ code: "maintenance_revision_transition_invalid", path: "maintenanceRevision", message: "Schema 3.0 updates must increment maintenanceRevision by exactly one" });
  }
  const currentGenerations = generations(currentPack);
  const candidateGenerations = generations(candidatePack);
  const currentById = new Map(currentGenerations.map((generation) => [String(generation.id), generation]));
  const candidateById = new Map(candidateGenerations.map((generation) => [String(generation.id), generation]));
  const dropped = currentGenerations.filter((generation) => !candidateById.has(String(generation.id)));
  const added = candidateGenerations.filter((generation) => !currentById.has(String(generation.id)));
  const numericIds = candidateGenerations.map((generation) => Number(String(generation.id).slice("generation-".length)));
  if (numericIds.some((id, index2) => index2 > 0 && id <= numericIds[index2 - 1])) {
    issues.push({ code: "archive_generation_order_invalid", path: "archive.generations", message: "Archive generations must be unique and ordered from oldest to newest" });
  }
  if (added.length > 1) {
    issues.push({ code: "archive_generation_sequence_invalid", path: "archive.generations", message: "One maintenance revision may create at most one archive generation" });
  } else if (added.length === 1) {
    const latestCurrent = currentGenerations.at(-1);
    const expectedNumber = latestCurrent ? Number(String(latestCurrent.id).slice("generation-".length)) + 1 : 1;
    const addedNumber = Number(String(added[0].id).slice("generation-".length));
    if (addedNumber !== expectedNumber || String(candidateGenerations.at(-1)?.id) !== String(added[0].id)) {
      issues.push({ code: "archive_generation_sequence_invalid", path: "archive.generations", message: "A new archive generation must be the consecutive newest generation" });
    }
    const createdAt = Date.parse(String(added[0].createdAt));
    const transactionTime = (input.now ?? Date.now)();
    const latestCreatedAt = latestCurrent ? Date.parse(String(latestCurrent.createdAt)) : Number.NEGATIVE_INFINITY;
    if (Number.isNaN(createdAt) || createdAt > transactionTime || createdAt < transactionTime - archiveTimestampWindowMs || latestCurrent !== void 0 && createdAt <= latestCreatedAt) {
      issues.push({ code: "archive_generation_timestamp_invalid", path: "archive.generations", message: "A new archive generation timestamp must be recent, non-future, and strictly later than retained history" });
    }
  }
  for (const [id, generation] of currentById) {
    const retained = candidateById.get(id);
    if (retained && !equalJson(retained, generation)) {
      issues.push({ code: "archive_generation_metadata_changed", path: "archive.generations", message: `Existing archive generation metadata is immutable: ${id}` });
    }
    if (retained && typeof generation.path === "string" && typeof retained.path === "string") {
      const [currentBytes, candidateBytes] = await Promise.all([
        input.readCurrent(generation.path),
        input.readCandidate(retained.path)
      ]);
      if (!currentBytes || !candidateBytes || !currentBytes.equals(candidateBytes)) {
        issues.push({ code: "archive_generation_content_changed", path: generation.path, message: `Existing archive generation content is immutable: ${id}` });
      }
    }
  }
  const readTombstones = async (pack, read, label) => {
    try {
      return await jsonLines2(tombstonePath(pack), tombstoneCount(pack), read);
    } catch (error) {
      issues.push({
        code: "tombstone_history_invalid",
        path: "archive.tombstones",
        message: `${label}: ${error instanceof Error ? error.message : "invalid tombstone JSONL"}`
      });
      return [];
    }
  };
  const currentTombstones = await readTombstones(currentPack, input.readCurrent, "Current tombstones are invalid");
  const candidateTombstones = await readTombstones(candidatePack, input.readCandidate, "Candidate tombstones are invalid");
  const candidateTombstonesById = new Map(candidateTombstones.map((item) => [String(item.id), item]));
  for (const prior of currentTombstones) {
    const retained = candidateTombstonesById.get(String(prior.id));
    if (!retained || !equalJson(prior, retained)) {
      issues.push({ code: "tombstone_history_removed", path: "archive.tombstones", message: `Existing tombstone is immutable and cannot be removed: ${String(prior.id)}` });
    }
  }
  if (dropped.length > 0) {
    const validRotation = currentGenerations.length === 2 && candidateGenerations.length === 2 && dropped.length === 1 && added.length === 1 && String(dropped[0].id) === String(currentGenerations[0].id) && String(candidateGenerations[0].id) === String(currentGenerations[1].id) && String(candidateGenerations[1].id) === String(added[0].id);
    if (!validRotation) {
      issues.push({ code: "archive_rotation_invalid", path: "archive.generations", message: "A full generation may be dropped only when a third generation rotates the oldest of two retained generations into tombstones" });
    }
  }
  const expectedNewTombstones = /* @__PURE__ */ new Map();
  for (const generation of dropped) {
    const source = await strictArchiveEntries(
      typeof generation.path === "string" ? generation.path : void 0,
      Number(generation.recordCount),
      input.readCurrent
    );
    issues.push(...source.issues);
    const entries = source.entries;
    for (const entry of entries) {
      const expected = tombstoneFor(entry);
      if (expected) expectedNewTombstones.set(String(expected.id), expected);
      const actual = expected ? candidateTombstonesById.get(String(expected.id)) : void 0;
      if (!expected || !actual || !equalJson(expected, actual)) {
        issues.push({ code: "archive_generation_not_tombstoned", path: String(generation.path), message: `Dropped archive record must be preserved as an exact tombstone: ${String(entry.record?.id ?? "unknown")}` });
      }
    }
  }
  const currentTombstonesById = new Map(currentTombstones.map((item) => [String(item.id), item]));
  for (const actual of candidateTombstones) {
    const id = String(actual.id);
    const expected = currentTombstonesById.get(id) ?? expectedNewTombstones.get(id);
    if (!expected || !equalJson(expected, actual)) {
      issues.push({ code: "tombstone_unexpected", path: "archive.tombstones", message: `Tombstone must be immutable prior history or derive exactly from the generation rotated now: ${id}` });
    }
  }
  const currentRecords = new Map(objects(currentPack.records).map((record) => [String(record.id), record]));
  const candidateRecords = new Map(objects(candidatePack.records).map((record) => [String(record.id), record]));
  const candidateRecordIds = new Set(candidateRecords.keys());
  for (const [id, currentRecord] of currentRecords) {
    const candidateRecord = candidateRecords.get(id);
    if (!candidateRecord) continue;
    const before = currentRecord.lifecycle;
    const after = candidateRecord.lifecycle;
    if (before?.state === "active" && after?.state === "terminal" && Number(after.confirmedRefreshes) !== 1) {
      issues.push({ code: "terminal_refresh_transition_invalid", path: `records.${id}.lifecycle`, message: `A newly terminal record must begin with one confirmed refresh: ${id}` });
    }
    if (before?.state === "terminal") {
      if (after?.state !== "terminal") {
        issues.push({ code: "terminal_record_reactivated", path: `records.${id}.lifecycle`, message: `A terminal record cannot return to active state: ${id}` });
        continue;
      }
      const beforeCount = Number(before.confirmedRefreshes);
      const afterCount = Number(after.confirmedRefreshes);
      if (afterCount < beforeCount || afterCount > beforeCount + 1) {
        issues.push({ code: "terminal_refresh_transition_invalid", path: `records.${id}.lifecycle.confirmedRefreshes`, message: `A terminal refresh count may increase by at most one per confirmed refresh: ${id}` });
      }
      for (const field of ["reason", "sinceRevision", "successorIds"]) {
        if (!equalJson(before[field], after[field])) {
          issues.push({ code: "terminal_history_changed", path: `records.${id}.lifecycle.${field}`, message: `Terminal history is immutable after confirmation: ${id}` });
        }
      }
    }
  }
  const newArchiveIds = /* @__PURE__ */ new Set();
  for (const generation of candidateGenerations.filter((item) => !currentById.has(String(item.id)))) {
    let entries = [];
    try {
      entries = await jsonLines2(
        typeof generation.path === "string" ? generation.path : void 0,
        generation.recordCount,
        input.readCandidate
      );
    } catch (error) {
      issues.push({
        code: "archive_generation_source_invalid",
        path: String(generation.path ?? "archive.generations"),
        message: error instanceof Error ? error.message : "Candidate archive generation JSONL is invalid"
      });
    }
    for (const entry of entries) {
      const id = typeof entry.record?.id === "string" ? entry.record.id : void 0;
      if (!id) continue;
      newArchiveIds.add(id);
      const currentRecord = currentRecords.get(id);
      if (!terminalEligible(currentRecord)) {
        issues.push({ code: "archive_record_transition_ineligible", path: String(generation.path), message: `Only an already-terminal record with two confirmed refreshes may be archived: ${id}` });
      }
      if (currentRecord && !equalJson(entry.record, currentRecord)) {
        issues.push({ code: "archive_record_content_changed", path: String(generation.path), message: `Archived record must exactly preserve the terminal active-pack record: ${id}` });
      }
      const owner = typeof currentRecord?.ownerDocument === "string" ? currentRecord.ownerDocument : void 0;
      const document = owner ? objects(currentPack.documents).find((item) => item.id === owner) : void 0;
      const currentBody = document && typeof document.path === "string" ? managedBody(await input.readCurrent(document.path), id) : void 0;
      if (typeof entry.managedBody === "string" && currentBody !== entry.managedBody) {
        issues.push({ code: "archive_record_managed_body_changed", path: String(generation.path), message: `Archived managed body must match the current owning block: ${id}` });
      }
      if (Number(entry.maintenanceRevision) !== Number(candidatePack.maintenanceRevision)) {
        issues.push({ code: "archive_record_revision_invalid", path: String(generation.path), message: `Archived record revision must equal the candidate maintenance revision: ${id}` });
      }
      if (entry.archivedAt !== generation.createdAt) {
        issues.push({ code: "archive_record_timestamp_invalid", path: String(generation.path), message: `Archived record timestamp must equal its generation timestamp: ${id}` });
      }
    }
  }
  for (const id of currentRecords.keys()) {
    if (!candidateRecordIds.has(id) && !newArchiveIds.has(id)) {
      issues.push({ code: "active_record_history_removed", path: "records", message: `Removed active-pack record is not preserved in a new archive generation: ${id}` });
    }
  }
  return issues;
}

// src/knowledge/history-integrity.ts
import { createHash as createHash7 } from "node:crypto";
var sha256HashSchema = external_exports.string().regex(/^sha256:[a-f0-9]{64}$/u);
var historyPathSchema = external_exports.string().refine((path) => safeRepositoryPath(path), "must be a canonical repository-relative path");
var managedDocumentPathSchema = external_exports.string().refine(
  (path) => safeRepositoryPath(path) && path.startsWith("docs/project-design/") && path.endsWith(".md"),
  "must be a canonical Markdown path under docs/project-design"
);
var historyIdSchema = stableId.max(256);
var safeHistoryIntegerSchema = external_exports.number().int().nonnegative().safe();
var historyGenerationMetadataSchema = external_exports.object({
  id: external_exports.string().regex(/^generation-[0-9]{6}$/u),
  path: historyPathSchema,
  recordCount: safeHistoryIntegerSchema.max(keeperLimits.pack.maxRecords),
  createdAt: external_exports.string().datetime()
}).strict();
var historyTombstoneMetadataSchema = external_exports.object({
  path: historyPathSchema,
  count: safeHistoryIntegerSchema.max(keeperLimits.pack.maxRecords)
}).strict();
var strictHistoryPackSchema = external_exports.object({
  managedBy: external_exports.literal("project-design-keeper"),
  schemaVersion: external_exports.literal("3.0"),
  maintenanceRevision: safeHistoryIntegerSchema,
  scope: external_exports.object({
    root: external_exports.literal("."),
    paths: external_exports.array(historyPathSchema).nonempty().max(keeperLimits.scan.maxFiles).optional()
  }).passthrough(),
  sourceRevision: external_exports.object({
    kind: external_exports.string().min(1),
    files: external_exports.record(historyPathSchema, sha256HashSchema).superRefine((files, context) => {
      const paths = Object.keys(files);
      if (paths.length === 0) {
        context.addIssue({ code: external_exports.ZodIssueCode.custom, message: "must contain source files" });
      }
      if (paths.length > keeperLimits.scan.maxFiles) {
        context.addIssue({
          code: external_exports.ZodIssueCode.custom,
          message: `must contain at most ${keeperLimits.scan.maxFiles} source files`
        });
      }
    })
  }).passthrough(),
  documents: external_exports.array(external_exports.object({
    id: historyIdSchema,
    path: managedDocumentPathSchema
  }).strict()).max(keeperLimits.pack.maxDocuments),
  records: external_exports.array(strictHistoryKnowledgeRecordSchema).max(keeperLimits.pack.maxRecords),
  archive: external_exports.object({
    generations: external_exports.array(historyGenerationMetadataSchema).max(2),
    tombstones: historyTombstoneMetadataSchema
  }).strict(),
  dedupeExceptions: external_exports.array(external_exports.object({
    leftId: historyIdSchema,
    rightId: historyIdSchema,
    leftDigest: sha256HashSchema,
    rightDigest: sha256HashSchema
  }).strict()).max(keeperLimits.redundancy.maxDecisions)
}).strict();
function schemaError(label, error) {
  const detail = error.issues.slice(0, 8).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : label;
    return `${path}: ${issue.message}`;
  }).join("; ");
  return new Error(`${label} is invalid${detail ? `: ${detail}` : ""}`);
}
function assertUnique(values, label) {
  const seen = /* @__PURE__ */ new Map();
  for (const value of values) {
    const key = windowsRepositoryPathKey(value);
    const prior = seen.get(key);
    if (prior !== void 0) throw new Error(`${label} contains a duplicate or aliased value: ${value}`);
    seen.set(key, value);
  }
}
function kindOwnsPath(kind, path) {
  if (kind === "module") return path.startsWith("docs/project-design/modules/") && path.endsWith(".md");
  const expected = {
    intent: "docs/project-design/intent.md",
    principle: "docs/project-design/principles.md",
    architecture: "docs/project-design/architecture.md",
    convention: "docs/project-design/conventions.md",
    decision: "docs/project-design/decisions.md",
    tuning: "docs/project-design/tuning.md",
    verification: "docs/project-design/verification.md",
    "open-question": "docs/project-design/open-questions.md"
  };
  return expected[kind] === path;
}
function rawRecordById(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return /* @__PURE__ */ new Map();
  const records = value.records;
  if (!Array.isArray(records)) return /* @__PURE__ */ new Map();
  return new Map(records.flatMap((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record) || typeof record.id !== "string") return [];
    return [[record.id, record]];
  }));
}
function parseCanonicalPackStructure(value) {
  const parsed = strictHistoryPackSchema.safeParse(value);
  if (!parsed.success) throw schemaError("History manifest", parsed.error);
  const pack = parsed.data;
  const allIds = [...pack.documents.map((document) => document.id), ...pack.records.map((record) => record.id)];
  if (new Set(allIds).size !== allIds.length) throw new Error("History manifest contains duplicate document or active record IDs");
  assertUnique(pack.documents.map((document) => document.path), "History manifest document paths");
  assertUnique(pack.scope.paths ?? [], "History manifest scope paths");
  assertUnique(Object.keys(pack.sourceRevision.files), "History manifest source revision paths");
  const documents = new Map(pack.documents.map((document) => [document.id, document.path]));
  const revisionPaths = new Set(Object.keys(pack.sourceRevision.files).map(windowsRepositoryPathKey));
  for (const record of pack.records) {
    const ownerPath = documents.get(record.ownerDocument);
    if (!ownerPath || !kindOwnsPath(record.kind, ownerPath)) {
      throw new Error(`History record owner is missing or incompatible: ${record.id}`);
    }
    for (const evidence of record.evidence) {
      if (!revisionPaths.has(windowsRepositoryPathKey(evidence.path))) {
        throw new Error(`History record evidence is not bound to sourceRevision.files: ${record.id}`);
      }
    }
  }
  const generationIds = pack.archive.generations.map((generation) => generation.id);
  const generationPaths = pack.archive.generations.map((generation) => generation.path);
  if (new Set(generationIds).size !== generationIds.length) throw new Error("History archive contains duplicate generation IDs");
  assertUnique(generationPaths, "History archive generation paths");
  for (const [index2, generation] of pack.archive.generations.entries()) {
    const number = Number(generation.id.slice("generation-".length));
    if (!Number.isSafeInteger(number) || number < 1) throw new Error(`History archive generation ID is invalid: ${generation.id}`);
    const expectedPath = `docs/project-design/archive/${generation.id}.records.jsonl`;
    if (generation.path !== expectedPath) throw new Error(`History archive generation path must be ${expectedPath}`);
    const prior = pack.archive.generations[index2 - 1];
    if (prior) {
      const priorNumber = Number(prior.id.slice("generation-".length));
      if (number !== priorNumber + 1 || Date.parse(generation.createdAt) <= Date.parse(prior.createdAt)) {
        throw new Error("History archive generations must be consecutive and ordered by ID and timestamp");
      }
    }
  }
  if (pack.archive.tombstones.path !== "docs/project-design/archive/tombstones.jsonl") {
    throw new Error("History tombstone path must be docs/project-design/archive/tombstones.jsonl");
  }
  const activeIds = new Set(pack.records.map((record) => record.id));
  const rawRecords = rawRecordById(value);
  const exceptionPairs = /* @__PURE__ */ new Set();
  for (const exception of pack.dedupeExceptions) {
    if (exception.leftId === exception.rightId || !activeIds.has(exception.leftId) || !activeIds.has(exception.rightId)) {
      throw new Error("History dedupe exception references invalid active record IDs");
    }
    const pair = [exception.leftId, exception.rightId].sort().join("\0");
    if (exceptionPairs.has(pair)) throw new Error("History dedupe exceptions contain a duplicate pair");
    exceptionPairs.add(pair);
    const digest = (record) => `sha256:${createHash7("sha256").update(JSON.stringify(record), "utf8").digest("hex")}`;
    if (digest(rawRecords.get(exception.leftId)) !== exception.leftDigest || digest(rawRecords.get(exception.rightId)) !== exception.rightDigest) {
      throw new Error("History dedupe exception digests do not match active records");
    }
  }
  return pack;
}
function parseArchiveGeneration(bytes, metadata) {
  const parsedMetadata = historyGenerationMetadataSchema.safeParse(metadata);
  if (!parsedMetadata.success) throw schemaError("History archive generation metadata", parsedMetadata.error);
  const canonicalMetadata = parsedMetadata.data;
  const expectedPath = `docs/project-design/archive/${canonicalMetadata.id}.records.jsonl`;
  if (canonicalMetadata.path !== expectedPath) throw new Error(`History archive generation path must be ${expectedPath}`);
  const lines = decodeCanonicalJsonLines(bytes, `History archive ${canonicalMetadata.path}`, {
    expectedCount: canonicalMetadata.recordCount
  });
  const entries = lines.map(({ value, line }) => {
    const parsed = archiveEntrySchema.safeParse(value);
    if (!parsed.success) throw schemaError(`History archive record at line ${line}`, parsed.error);
    if (!isCompleteArchiveEntry(parsed.data)) throw new Error(`History archive record is incomplete at line ${line}`);
    if (parsed.data.archivedAt !== canonicalMetadata.createdAt) {
      throw new Error(`History archive record timestamp does not match ${canonicalMetadata.id}`);
    }
    return parsed.data;
  });
  const ids = entries.map((entry) => entry.record.id);
  if (new Set(ids).size !== ids.length) throw new Error(`History archive generation contains duplicate record IDs: ${canonicalMetadata.id}`);
  const revisions = new Set(entries.map((entry) => entry.maintenanceRevision));
  if (revisions.size > 1) throw new Error(`History archive generation contains inconsistent maintenance revisions: ${canonicalMetadata.id}`);
  return {
    metadata: canonicalMetadata,
    entries,
    ...entries[0] ? { maintenanceRevision: entries[0].maintenanceRevision } : {}
  };
}
function parseTombstones(bytes, expectedCount) {
  const parsedCount = safeHistoryIntegerSchema.max(keeperLimits.pack.maxRecords).safeParse(expectedCount);
  if (!parsedCount.success) throw schemaError("History tombstone count", parsedCount.error);
  const lines = decodeCanonicalJsonLines(bytes, "History tombstone", { expectedCount: parsedCount.data });
  const tombstones = lines.map(({ value, line }) => {
    const parsed = tombstoneSchema.safeParse(value);
    if (!parsed.success) throw schemaError(`History tombstone at line ${line}`, parsed.error);
    return parsed.data;
  });
  const ids = tombstones.map((tombstone) => tombstone.id);
  if (new Set(ids).size !== ids.length) throw new Error("History tombstones contain duplicate record IDs");
  return tombstones;
}
function terminalSuccessors(record) {
  return record.lifecycle.state === "terminal" ? record.lifecycle.successorIds : [];
}
function validateHistoryRelationships(pack, generations2, tombstones) {
  if (generations2.length !== pack.archive.generations.length) {
    throw new Error("History archive generations are incomplete");
  }
  const documents = new Map(pack.documents.map((document) => [document.id, document.path]));
  const identities = /* @__PURE__ */ new Set();
  for (const document of pack.documents) {
    if (identities.has(document.id)) throw new Error(`History contains a duplicate ID: ${document.id}`);
    identities.add(document.id);
  }
  const nodes = /* @__PURE__ */ new Map();
  const addNode = (node) => {
    if (identities.has(node.id)) throw new Error(`History contains a duplicate ID across tiers: ${node.id}`);
    identities.add(node.id);
    nodes.set(node.id, node);
  };
  const validateOwner = (record) => {
    const owner = documents.get(record.ownerDocument);
    if (!owner || !kindOwnsPath(record.kind, owner)) {
      throw new Error(`History record owner is missing or incompatible: ${record.id}`);
    }
  };
  for (const record of pack.records) {
    validateOwner(record);
    if (record.lifecycle.state === "terminal" && record.lifecycle.sinceRevision > pack.maintenanceRevision) {
      throw new Error(`History terminal record revision is in the future: ${record.id}`);
    }
    addNode({ id: record.id, record, successorIds: terminalSuccessors(record), tier: "active" });
  }
  let priorGenerationRevision = -1;
  for (const [index2, generation] of generations2.entries()) {
    const expected = pack.archive.generations[index2];
    if (!expected || JSON.stringify(generation.metadata) !== JSON.stringify(expected)) {
      throw new Error("History archive generation metadata changed during validation");
    }
    if (generation.maintenanceRevision === void 0) {
      if (generation.metadata.recordCount !== 0) throw new Error(`History archive generation revision is missing: ${generation.metadata.id}`);
    } else {
      if (generation.maintenanceRevision > pack.maintenanceRevision || generation.maintenanceRevision <= priorGenerationRevision) {
        throw new Error("History archive generation revisions must be ordered and not exceed the pack revision");
      }
      priorGenerationRevision = generation.maintenanceRevision;
    }
    for (const entry of generation.entries) {
      validateOwner(entry.record);
      if (entry.originalOwnerDocument !== entry.record.ownerDocument || entry.record.lifecycle.state !== "terminal" || entry.record.lifecycle.confirmedRefreshes < 2 || entry.record.lifecycle.sinceRevision > entry.maintenanceRevision) {
        throw new Error(`History archive record owner, lifecycle, or revision is invalid: ${entry.record.id}`);
      }
      addNode({
        id: entry.record.id,
        record: entry.record,
        successorIds: entry.record.lifecycle.successorIds,
        tier: `archive:${generation.metadata.id}`
      });
    }
  }
  for (const tombstone of tombstones) {
    addNode({ id: tombstone.id, successorIds: tombstone.successorIds, tier: "tombstone" });
  }
  const edges = new Map([...nodes.keys()].map((id) => [id, /* @__PURE__ */ new Set()]));
  let edgeCount = 0;
  const maximumEdges = keeperLimits.pack.maxRecords * 4;
  const addEdge = (successorId, predecessorId, label) => {
    if (!nodes.has(successorId)) throw new Error(`${label} references an unknown successor: ${successorId}`);
    if (!nodes.has(predecessorId)) throw new Error(`${label} references an unknown predecessor: ${predecessorId}`);
    if (successorId === predecessorId) throw new Error(`${label} contains a self relationship: ${successorId}`);
    const outgoing = edges.get(successorId);
    if (!outgoing.has(predecessorId)) {
      edgeCount += 1;
      if (edgeCount > maximumEdges) throw new Error(`History successor relationships exceed the limit of ${maximumEdges}`);
      outgoing.add(predecessorId);
    }
  };
  for (const node of nodes.values()) {
    if (new Set(node.successorIds).size !== node.successorIds.length) {
      throw new Error(`History successor IDs contain duplicates: ${node.id}`);
    }
    for (const successorId of node.successorIds) {
      addEdge(successorId, node.id, `History successor relationship for ${node.id}`);
      const successor = nodes.get(successorId)?.record;
      if (successor?.supersedes !== void 0 && successor.supersedes !== node.id) {
        throw new Error(`History successor encodings contradict each other: ${successorId}`);
      }
    }
    const record = node.record;
    if (!record) continue;
    if (record.supersedes !== void 0) {
      const predecessor = nodes.get(record.supersedes);
      if (!predecessor) throw new Error(`History supersedes relationship is broken: ${record.id}`);
      if (predecessor.record?.lifecycle.state === "active") {
        throw new Error(`History record cannot supersede an active predecessor: ${record.id}`);
      }
      if (!predecessor.successorIds.includes(record.id)) {
        throw new Error(`History supersedes relationship is not reciprocal: ${record.id}`);
      }
      if (predecessor.record?.supersededBy !== void 0 && predecessor.record.supersededBy !== record.id) {
        throw new Error(`History supersedes relationship contradicts supersededBy: ${record.id}`);
      }
      addEdge(record.id, record.supersedes, `History supersedes relationship for ${record.id}`);
    }
    if (record.supersededBy !== void 0) {
      if (record.lifecycle.state !== "terminal") {
        throw new Error(`History active record cannot declare supersededBy: ${record.id}`);
      }
      if (!node.successorIds.includes(record.supersededBy)) {
        throw new Error(`History supersededBy relationship is not reciprocal: ${record.id}`);
      }
      const successor = nodes.get(record.supersededBy)?.record;
      if (successor?.supersedes !== void 0 && successor.supersedes !== record.id) {
        throw new Error(`History supersededBy relationship contradicts supersedes: ${record.id}`);
      }
      addEdge(record.supersededBy, record.id, `History supersededBy relationship for ${record.id}`);
    }
  }
  const indegree = new Map([...nodes.keys()].map((id) => [id, 0]));
  for (const outgoing of edges.values()) {
    for (const target of outgoing) indegree.set(target, (indegree.get(target) ?? 0) + 1);
  }
  const ready = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id);
  let visited = 0;
  for (let index2 = 0; index2 < ready.length; index2 += 1) {
    const id = ready[index2];
    visited += 1;
    for (const target of edges.get(id) ?? []) {
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) ready.push(target);
    }
  }
  if (visited !== nodes.size) throw new Error("History successor graph contains a cycle");
}
async function loadAndValidateHistoryOverlay(value, read) {
  const pack = parseCanonicalPackStructure(value);
  const generations2 = [];
  for (const metadata of pack.archive.generations) {
    const bytes = await read(metadata.path);
    if (!bytes) throw new Error(`History archive generation is missing: ${metadata.path}`);
    generations2.push(parseArchiveGeneration(bytes, metadata));
  }
  const tombstoneBytes = await read(pack.archive.tombstones.path);
  if (!tombstoneBytes && pack.archive.tombstones.count !== 0) {
    throw new Error(`History tombstone file is missing: ${pack.archive.tombstones.path}`);
  }
  const tombstones = tombstoneBytes ? parseTombstones(tombstoneBytes, pack.archive.tombstones.count) : [];
  validateHistoryRelationships(pack, generations2, tombstones);
  return { pack, generations: generations2, tombstones };
}

// src/security/approval.ts
function snapshotBinding(binding) {
  return {
    root: binding.root,
    changesetId: binding.changesetId,
    diffDigest: binding.diffDigest,
    expiresAt: binding.expiresAt,
    paths: [...binding.paths],
    summary: { ...binding.summary },
    archiveActions: {
      archivedRecordIds: [...binding.archiveActions.archivedRecordIds],
      tombstonedRecordIds: [...binding.archiveActions.tombstonedRecordIds]
    },
    semanticDecisionIds: [...binding.semanticDecisionIds]
  };
}
function equalStrings(left, right) {
  return left.length === right.length && left.every((value, index2) => value === right[index2]);
}
function equalBindings(left, right) {
  return left.root === right.root && left.changesetId === right.changesetId && left.diffDigest === right.diffDigest && left.expiresAt === right.expiresAt && equalStrings(left.paths, right.paths) && left.summary.create === right.summary.create && left.summary.update === right.summary.update && left.summary.delete === right.summary.delete && equalStrings(left.archiveActions.archivedRecordIds, right.archiveActions.archivedRecordIds) && equalStrings(left.archiveActions.tombstonedRecordIds, right.archiveActions.tombstonedRecordIds) && equalStrings(left.semanticDecisionIds, right.semanticDecisionIds);
}
function createApplyApprovalAuthority(now) {
  const records = /* @__PURE__ */ new WeakMap();
  return {
    issue(binding, requestIdentity) {
      if (now() >= binding.expiresAt) throw new Error("Apply authorization cannot be issued for an expired changeset");
      const authorization = Object.freeze(/* @__PURE__ */ Object.create(null));
      records.set(authorization, {
        binding: snapshotBinding(binding),
        requestIdentity,
        consumed: false
      });
      return authorization;
    },
    consume(authorization, expectedBinding, requestIdentity) {
      const record = records.get(authorization);
      if (!record) throw new Error("Apply authorization capability is invalid");
      if (record.consumed) throw new Error("Apply authorization capability was already consumed");
      record.consumed = true;
      if (now() >= record.binding.expiresAt) throw new Error("Apply authorization capability has expired");
      if (record.requestIdentity !== requestIdentity) throw new Error("Apply authorization request identity does not match");
      if (!equalBindings(record.binding, expectedBinding)) throw new Error("Apply authorization binding does not match the authenticated changeset");
    }
  };
}

// src/changesets/store.ts
import { createHash as createHash8, createHmac as createHmac4, randomBytes as randomBytes6, timingSafeEqual as timingSafeEqual4 } from "node:crypto";
import { lstat as lstat8, open as open8, opendir as opendir5 } from "node:fs/promises";
import { join as join6 } from "node:path";
var uuidV4Pattern = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
var publicationTemporaryEntryPattern = new RegExp(`^\\.${uuidV4Pattern}\\.tmp$`, "u");
var claimInitializationEntryPattern = new RegExp(`^\\.claim-${uuidV4Pattern}\\.tmp$`, "u");
var releasedClaimEntryPattern = /^(\.publish-.+\.json)\.release-[a-f0-9]{32}$/u;
var maximumInventoryEntries = keeperLimits.changesets.maxPairsGlobal * 4;
var pairPublicationEntryHeadroom = 4;
function parseChangesetEntryName(name2) {
  const signature2 = name2.endsWith(".sig.json");
  if (!signature2 && !name2.endsWith(".json")) return void 0;
  const id = name2.slice(0, signature2 ? -".sig.json".length : -".json".length);
  if (!isCanonicalUuid(id)) return void 0;
  return { id, kind: signature2 ? "signature" : "changeset" };
}
function publicationClaimTargetName(name2) {
  if (!name2.startsWith(".publish-")) return void 0;
  const targetName = name2.slice(".publish-".length);
  return parseChangesetEntryName(targetName) ? targetName : void 0;
}
function isReleasedClaimEntry(name2) {
  const match = releasedClaimEntryPattern.exec(name2);
  return Boolean(match && publicationClaimTargetName(match[1]));
}
var cacheStoreLocks = /* @__PURE__ */ new Map();
async function withCacheStoreLock(cacheRoot, operation) {
  const key = process.platform === "win32" ? cacheRoot.toLocaleLowerCase("en-US") : cacheRoot;
  let state = cacheStoreLocks.get(key);
  if (!state) {
    state = { tail: Promise.resolve(), users: 0 };
    cacheStoreLocks.set(key, state);
  }
  state.users += 1;
  const predecessor = state.tail;
  let release;
  const turn = new Promise((resolveTurn) => {
    release = resolveTurn;
  });
  state.tail = predecessor.then(() => turn);
  await predecessor;
  try {
    return await operation();
  } finally {
    release();
    state.users -= 1;
    if (state.users === 0 && cacheStoreLocks.get(key) === state) cacheStoreLocks.delete(key);
  }
}
function changesetPath(cache, changesetId) {
  if (!isCanonicalUuid(changesetId)) throw new Error("Invalid canonical changeset id");
  return join6(cache.changesets, `${changesetId}.json`);
}
function signaturePath(cache, changesetId) {
  if (!isCanonicalUuid(changesetId)) throw new Error("Invalid canonical changeset id");
  return join6(cache.changesets, `${changesetId}.sig.json`);
}
function canonicalJson2(value) {
  const normalize = (candidate) => {
    if (Array.isArray(candidate)) return candidate.map(normalize);
    if (typeof candidate === "object" && candidate !== null) {
      return Object.fromEntries(Object.entries(candidate).sort(([left], [right]) => left.localeCompare(right, "en-US")).map(([key, nested]) => [key, normalize(nested)]));
    }
    return candidate;
  };
  return JSON.stringify(normalize(value));
}
function persistedDiffDigest(changes, semanticDecisionIds2) {
  return `sha256:${createHash8("sha256").update(canonicalJson2({ changes, semanticDecisionIds: semanticDecisionIds2 }), "utf8").digest("hex")}`;
}
function projectDigest(root) {
  const canonical2 = process.platform === "win32" ? root.toLocaleLowerCase("en-US") : root;
  return createHash8("sha256").update(canonical2, "utf8").digest("hex");
}
function bytesDigest(bytes) {
  return createHash8("sha256").update(bytes).digest("hex");
}
function changesetMac(key, value) {
  return createHmac4("sha256", key).update(canonicalJson2(value), "utf8").digest("hex");
}
function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${label} is malformed`, { cause: error });
  }
}
function parseSignature(value, changesetId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Changeset signature is malformed");
  }
  const record = value;
  const keys = Object.keys(record).sort();
  if (keys.length !== 4 || keys[0] !== "algorithm" || keys[1] !== "changesetId" || keys[2] !== "mac" || keys[3] !== "version" || record.version !== 1 || record.algorithm !== "hmac-sha256" || record.changesetId !== changesetId || typeof record.mac !== "string" || !/^[a-f0-9]{64}$/u.test(record.mac)) {
    throw new Error("Changeset signature is malformed");
  }
  return record;
}
function parsePersistedChangeset(value) {
  const result = persistedChangesetSchema.safeParse(value);
  if (!result.success) {
    const detail = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Persisted changeset is malformed: ${detail}`);
  }
  return result.data;
}
function assertIdentityEqual(expected, actual) {
  if (expected.dev !== actual.dev || expected.ino !== actual.ino || expected.kind !== actual.kind || expected.parentDev !== actual.parentDev || expected.parentIno !== actual.parentIno || !sameFilesystemPath(expected.path, actual.path) || !sameFilesystemPath(expected.parent, actual.parent)) {
    throw new Error("Cache file identity changed or was replaced");
  }
}
async function cacheFileMetadata(cache, path, label, maxBytes) {
  await validateCacheFile(cache, path, false);
  const identity = await captureSecurePathIdentity(cache, path, "file");
  const metadata = await lstat8(path, { bigint: true });
  if (metadata.dev !== identity.dev || metadata.ino !== identity.ino || !metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`${label} identity changed during validation`);
  }
  if (metadata.size > BigInt(maxBytes)) throw new Error(`${label} exceeds the limit of ${maxBytes} bytes`);
  const size = Number(metadata.size);
  const mtimeMs = Number(metadata.mtimeMs);
  if (!Number.isSafeInteger(size) || size < 0 || !Number.isFinite(mtimeMs)) {
    throw new Error(`${label} has invalid filesystem metadata`);
  }
  return { path, identity, size, mtimeMs };
}
async function readMetadataFile(cache, metadata, label, beforeFinalValidation = async () => void 0) {
  await validateSecurePathIdentity(cache, metadata.identity);
  const handle = await open8(metadata.path, "r");
  try {
    const before = await handle.stat({ bigint: true });
    assertSecureOwnerFileMetadata(before, metadata.path, 1n);
    if (before.dev !== metadata.identity.dev || before.ino !== metadata.identity.ino || !before.isFile() || before.isSymbolicLink() || before.size !== BigInt(metadata.size)) {
      throw new Error(`${label} identity or byte length changed before bounded read`);
    }
    const bytes = Buffer.allocUnsafe(metadata.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const result = await handle.read(bytes, offset, bytes.byteLength - offset, offset);
      if (result.bytesRead === 0) throw new Error(`${label} ended during bounded read`);
      offset += result.bytesRead;
    }
    const overflowProbe = Buffer.allocUnsafe(1);
    if ((await handle.read(overflowProbe, 0, 1, metadata.size)).bytesRead !== 0) {
      throw new Error(`${label} exceeded its validated byte length during bounded read`);
    }
    await beforeFinalValidation(metadata.path);
    const after = await handle.stat({ bigint: true });
    assertSecureOwnerFileMetadata(after, metadata.path, 1n);
    if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size) {
      throw new Error(`${label} identity or byte length changed during bounded read`);
    }
    await validateSecurePathIdentity(cache, metadata.identity);
    await validateCacheFile(cache, metadata.path, false);
    return bytes;
  } finally {
    await handle.close();
  }
}
async function optionalAuthenticationKey(cache, beforeFinalValidation) {
  const path = join6(cache.root, "changeset-hmac.key");
  try {
    await lstat8(path);
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
  const metadata = await cacheFileMetadata(cache, path, "Persistent HMAC key", 32);
  if (metadata.size !== 32) throw new Error("Persistent HMAC key is invalid");
  return readMetadataFile(cache, metadata, "Persistent HMAC key", beforeFinalValidation);
}
async function cacheContainsEvidence(cache) {
  const directory = await opendir5(cache.changesets);
  try {
    return await directory.read() !== null;
  } finally {
    await directory.close().catch(() => void 0);
  }
}
async function authenticationKey(cache, beforeFinalValidation) {
  const existing = await optionalAuthenticationKey(cache, beforeFinalValidation);
  if (existing) return existing;
  if (await cacheContainsEvidence(cache)) {
    throw new Error("Persistent authentication key is missing while changeset cache evidence remains");
  }
  const path = join6(cache.root, "changeset-hmac.key");
  try {
    await publishExclusiveFile(cache, path, randomBytes6(32));
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const created = await optionalAuthenticationKey(cache, beforeFinalValidation);
  if (!created) throw new Error("Persistent HMAC key could not be created");
  return created;
}
async function readAuthenticatedPair(cache, changesetId, changesetMetadata, signatureMetadata, beforeFinalValidation) {
  const [changesetBytes, signatureBytes, key] = await Promise.all([
    readMetadataFile(cache, changesetMetadata, "Persisted changeset", beforeFinalValidation),
    readMetadataFile(cache, signatureMetadata, "Changeset signature", beforeFinalValidation),
    optionalAuthenticationKey(cache, beforeFinalValidation)
  ]);
  if (!key) throw new Error("Persistent HMAC key is missing");
  const raw = parseJson(changesetBytes, "Persisted changeset");
  const signature2 = parseSignature(parseJson(signatureBytes, "Changeset signature"), changesetId);
  const actual = Buffer.from(changesetMac(key, raw), "hex");
  const expected = Buffer.from(signature2.mac, "hex");
  if (actual.byteLength !== expected.byteLength || !timingSafeEqual4(actual, expected)) {
    throw new Error("Changeset signature authentication failed; cached data may have been tampered with");
  }
  return { raw, changesetBytes, signatureBytes };
}
function parseAuthenticatedVersionTwo(cache, changesetId, changesetMetadata, signatureMetadata, authenticated, options) {
  const { raw, changesetBytes, signatureBytes } = authenticated;
  if (raw && typeof raw === "object" && !Array.isArray(raw) && raw.version === 1) {
    throw new Error(`Changeset ${changesetId} uses an expired format; preview the update again`);
  }
  const changeset = parsePersistedChangeset(raw);
  if (changeset.changesetId !== changesetId) throw new Error("Persisted changeset ID does not match its filename");
  if (!options.allowExpired && options.now >= changeset.expiresAt) throw new Error(`Changeset ${changesetId} has expired`);
  if (options.expectedRoot !== void 0 && changeset.root !== options.expectedRoot) {
    throw new Error("Changeset root does not match the requested project root");
  }
  if (persistedDiffDigest(changeset.changes, changeset.semanticDecisionIds) !== changeset.diffDigest) {
    throw new Error("Persisted changeset diff digest does not match its authenticated changes");
  }
  return {
    changeset,
    cache,
    changesetPath: changesetMetadata.path,
    signaturePath: signatureMetadata.path,
    changesetBytes,
    signatureBytes,
    changesetIdentity: changesetMetadata.identity,
    signatureIdentity: signatureMetadata.identity
  };
}
async function authenticatePair(cache, changesetId, changesetMetadata, signatureMetadata, options, beforeFinalValidation) {
  return parseAuthenticatedVersionTwo(
    cache,
    changesetId,
    changesetMetadata,
    signatureMetadata,
    await readAuthenticatedPair(cache, changesetId, changesetMetadata, signatureMetadata, beforeFinalValidation),
    options
  );
}
async function validatePairIdentities(cache, loaded) {
  await validateSecurePathIdentity(cache, loaded.changesetIdentity);
  await validateSecurePathIdentity(cache, loaded.signatureIdentity);
}
async function pathPresent(path) {
  try {
    await lstat8(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function removeExactPair(cache, changesetIdentity, signatureIdentity, removeExactFile) {
  await validateSecurePathIdentity(cache, changesetIdentity);
  await validateSecurePathIdentity(cache, signatureIdentity);
  await removeExactFile(cache, changesetIdentity);
  try {
    await removeExactFile(cache, signatureIdentity);
  } catch (error) {
    throw new Error("Changeset primary half was removed but exact signature cleanup failed", { cause: error });
  }
}
function quotaError(label, limit) {
  return new Error(`${label} quota of ${limit} live pairs would be exceeded; live changesets are never evicted`);
}
function createChangesetStore(options = {}) {
  const now = options.now ?? (() => Date.now());
  const limits = resolveKeeperLimits(options.limits);
  const io = {
    publishFile: options.io?.publishFile ?? publishExclusiveFile,
    removeExactFile: options.io?.removeExactFile ?? safeRemoveExactCacheFile,
    beforePairPublication: options.io?.beforePairPublication ?? (async () => void 0),
    afterInventoryClaimReconciliation: options.io?.afterInventoryClaimReconciliation ?? (async () => void 0),
    beforeBoundedReadFinalValidation: options.io?.beforeBoundedReadFinalValidation ?? (async () => void 0)
  };
  const preparedStates = /* @__PURE__ */ new WeakMap();
  const secureCache = (root) => prepareSecureCache({
    cacheDirectory: options.cacheDirectory,
    environment: options.environment,
    homeDirectory: options.homeDirectory
  }, root);
  async function readBoundedDirectoryEntries(cache) {
    const directoryEntries = [];
    const directory = await opendir5(cache.changesets);
    try {
      for await (const entry of directory) {
        if (directoryEntries.length >= maximumInventoryEntries) {
          throw new Error(`Changeset cache contains more than ${maximumInventoryEntries} bounded entries`);
        }
        directoryEntries.push({ name: entry.name, isFile: entry.isFile() });
      }
    } finally {
      await directory.close().catch(() => void 0);
    }
    return directoryEntries;
  }
  async function inventoryAndCollect(cache) {
    const removalRecoveryUsage = await reconcileExactRemovalIntents(cache);
    const pairs = /* @__PURE__ */ new Map();
    let directoryEntries;
    let previousClaimCount;
    let reconciliationBudget = maximumInventoryEntries;
    for (; ; ) {
      directoryEntries = await readBoundedDirectoryEntries(cache);
      const claims = directoryEntries.map((entry) => ({ entry, targetName: publicationClaimTargetName(entry.name) })).filter((candidate) => candidate.targetName !== void 0).sort((left, right) => left.entry.name.localeCompare(right.entry.name, "en-US"));
      if (claims.length === 0) break;
      if (previousClaimCount !== void 0 && claims.length >= previousClaimCount) {
        throw new Error("Changeset publication residue did not stabilize during bounded reconciliation churn");
      }
      if (claims.length > reconciliationBudget) {
        throw new Error("Changeset publication residue exceeded its bounded reconciliation budget");
      }
      previousClaimCount = claims.length;
      for (const { entry, targetName } of claims) {
        if (!entry.isFile) throw new Error(`Changeset publication claim is not an ordinary file: ${entry.name}`);
        const result = await reconcileCacheFilePublication(cache, join6(cache.changesets, targetName));
        if (result.state === "active") {
          throw new Error("Changeset cache publication is still owned by an active process");
        }
        reconciliationBudget -= 1;
        await io.afterInventoryClaimReconciliation();
      }
    }
    let artifactBytes = removalRecoveryUsage.retainedBytes;
    let artifactEntries = 0;
    for (const entry of directoryEntries) {
      const path = join6(cache.changesets, entry.name);
      const isPublicationTemporary = publicationTemporaryEntryPattern.test(entry.name);
      const isClaimInitialization = claimInitializationEntryPattern.test(entry.name);
      const isReleasedClaim = isReleasedClaimEntry(entry.name);
      if (isPublicationTemporary || isClaimInitialization || isReleasedClaim) {
        if (!entry.isFile) throw new Error(`Changeset publication artifact is not an ordinary file: ${entry.name}`);
        const metadata2 = await cacheFileMetadata(
          cache,
          path,
          "Changeset publication artifact",
          isPublicationTemporary ? limits.changesets.maxChangesetBytes : limits.changesets.maxSignatureBytes
        );
        artifactBytes += metadata2.size;
        artifactEntries += 1;
        continue;
      }
      const parsedEntry = parseChangesetEntryName(entry.name);
      if (!parsedEntry || !entry.isFile) {
        throw new Error(`Changeset cache entry is malformed or not an ordinary final file: ${entry.name}`);
      }
      const { id, kind } = parsedEntry;
      const metadata = await cacheFileMetadata(
        cache,
        path,
        kind === "signature" ? "Changeset signature" : "Persisted changeset",
        kind === "signature" ? limits.changesets.maxSignatureBytes : limits.changesets.maxChangesetBytes
      );
      const pair = pairs.get(id) ?? {};
      if (pair[kind]) throw new Error(`Changeset cache contains a duplicate ${kind} half`);
      pair[kind] = metadata;
      pairs.set(id, pair);
    }
    const inventory = {
      livePairs: 0,
      projectPairs: /* @__PURE__ */ new Map(),
      retainedBytes: artifactBytes,
      retainedEntries: artifactEntries
    };
    for (const [id, pair] of [...pairs.entries()].sort(([left], [right]) => left.localeCompare(right, "en-US"))) {
      if (pair.changeset && pair.signature) {
        const authenticated = await readAuthenticatedPair(
          cache,
          id,
          pair.changeset,
          pair.signature,
          io.beforeBoundedReadFinalValidation
        );
        if (authenticated.raw && typeof authenticated.raw === "object" && !Array.isArray(authenticated.raw) && authenticated.raw.version === 1) {
          const legacy = expiredPersistedChangesetV1Schema.safeParse(authenticated.raw);
          if (!legacy.success) {
            const detail = legacy.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
            throw new Error(`Persisted version-one changeset is malformed: ${detail}`);
          }
          if (legacy.data.changesetId !== id) {
            throw new Error("Persisted version-one changeset ID does not match its filename");
          }
          if (now() >= legacy.data.expiresAt) {
            await removeExactPair(cache, pair.changeset.identity, pair.signature.identity, io.removeExactFile);
          } else {
            inventory.retainedBytes += pair.changeset.size + pair.signature.size;
            inventory.retainedEntries += 2;
          }
          continue;
        }
        const loaded = parseAuthenticatedVersionTwo(cache, id, pair.changeset, pair.signature, authenticated, {
          allowExpired: true,
          now: now()
        });
        if (now() >= loaded.changeset.expiresAt) {
          await removeExactPair(cache, loaded.changesetIdentity, loaded.signatureIdentity, io.removeExactFile);
          continue;
        }
        const digest = projectDigest(loaded.changeset.root);
        inventory.livePairs += 1;
        inventory.projectPairs.set(digest, (inventory.projectPairs.get(digest) ?? 0) + 1);
        inventory.retainedBytes += pair.changeset.size + pair.signature.size;
        inventory.retainedEntries += 2;
        continue;
      }
      const orphan = pair.changeset ?? pair.signature;
      if (now() - orphan.mtimeMs >= changesetLifetimeMs) {
        await io.removeExactFile(cache, orphan.identity);
        continue;
      }
      inventory.retainedBytes += orphan.size;
      inventory.retainedEntries += 1;
    }
    return inventory;
  }
  function preparedState(prepared) {
    const state = preparedStates.get(prepared);
    if (!state) throw new Error("Changeset publication was not prepared by this store");
    if (bytesDigest(prepared.changesetBytes) !== state.changesetDigest || bytesDigest(prepared.signatureBytes) !== state.signatureDigest || prepared.changesetBytes.byteLength + prepared.signatureBytes.byteLength !== state.pairBytes || prepared.changesetId !== state.changesetId || prepared.projectDigest !== state.projectDigest || prepared.expiresAt !== state.expiresAt || !sameFilesystemPath(prepared.changesetPath, changesetPath(state.cache, state.changesetId)) || !sameFilesystemPath(prepared.signaturePath, signaturePath(state.cache, state.changesetId))) {
      throw new Error("Prepared changeset publication bytes or bindings changed before publication");
    }
    return state;
  }
  function assertQuota(inventory, state) {
    if (inventory.retainedEntries + pairPublicationEntryHeadroom > maximumInventoryEntries) {
      throw new Error(
        `Changeset cache entry inventory cannot reserve publication headroom within ${maximumInventoryEntries} entries`
      );
    }
    const projectPairs = inventory.projectPairs.get(state.projectDigest) ?? 0;
    if (projectPairs + 1 > limits.changesets.maxPairsPerProject) {
      throw quotaError("Per-project changeset", limits.changesets.maxPairsPerProject);
    }
    if (inventory.livePairs + 1 > limits.changesets.maxPairsGlobal) {
      throw quotaError("Global changeset", limits.changesets.maxPairsGlobal);
    }
    if (inventory.retainedBytes + state.pairBytes > limits.changesets.maxTotalBytes) {
      throw new Error(`Changeset cache bytes exceed the aggregate limit of ${limits.changesets.maxTotalBytes} bytes`);
    }
  }
  async function publishHalf(cache, path, bytes, recordIdentity) {
    let publishedIdentity;
    await io.publishFile(cache, path, bytes, {
      afterPublishedIdentity: async (identity) => {
        publishedIdentity = identity;
        recordIdentity(identity);
      }
    });
    if (!publishedIdentity) throw new Error("Cache publication completed without an exact published identity");
    return publishedIdentity;
  }
  async function cleanupPublicationFailure(cache, primary, identities) {
    const cleanupErrors = [];
    for (const identity of identities) {
      if (!identity) continue;
      try {
        await io.removeExactFile(cache, identity);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [primary, ...cleanupErrors],
        "Changeset pair publication failed and exact cleanup was ambiguous",
        { cause: primary }
      );
    }
    throw primary;
  }
  async function preparePublication(changeset) {
    const parsed = parsePersistedChangeset(changeset);
    if (persistedDiffDigest(parsed.changes, parsed.semanticDecisionIds) !== parsed.diffDigest) {
      throw new Error("Persisted changeset diff digest does not match its authenticated changes");
    }
    if (now() >= parsed.expiresAt) throw new Error(`Changeset ${parsed.changesetId} has expired`);
    const changesetBytes = Buffer.from(`${JSON.stringify(parsed, null, 2)}
`, "utf8");
    if (changesetBytes.byteLength > limits.changesets.maxChangesetBytes) {
      throw new Error(`Persisted changeset exceeds the limit of ${limits.changesets.maxChangesetBytes} bytes`);
    }
    const cache = await secureCache(parsed.root);
    const key = await authenticationKey(cache, io.beforeBoundedReadFinalValidation);
    const signature2 = {
      version: 1,
      algorithm: "hmac-sha256",
      changesetId: parsed.changesetId,
      mac: changesetMac(key, parsed)
    };
    const signatureBytes = Buffer.from(`${JSON.stringify(signature2, null, 2)}
`, "utf8");
    if (signatureBytes.byteLength > limits.changesets.maxSignatureBytes) {
      throw new Error(`Changeset signature exceeds the limit of ${limits.changesets.maxSignatureBytes} bytes`);
    }
    const digest = projectDigest(parsed.root);
    const prepared = Object.freeze({
      changesetId: parsed.changesetId,
      changesetPath: changesetPath(cache, parsed.changesetId),
      signaturePath: signaturePath(cache, parsed.changesetId),
      changesetBytes,
      signatureBytes,
      projectDigest: digest,
      expiresAt: parsed.expiresAt
    });
    preparedStates.set(prepared, {
      cache,
      changesetId: parsed.changesetId,
      root: parsed.root,
      projectDigest: digest,
      expiresAt: parsed.expiresAt,
      changesetBytes: Buffer.from(changesetBytes),
      signatureBytes: Buffer.from(signatureBytes),
      changesetDigest: bytesDigest(changesetBytes),
      signatureDigest: bytesDigest(signatureBytes),
      pairBytes: changesetBytes.byteLength + signatureBytes.byteLength
    });
    return prepared;
  }
  async function publishPair(prepared) {
    const initialState = preparedState(prepared);
    await withCacheStoreLock(initialState.cache.root, async () => {
      let state = preparedState(prepared);
      if (now() >= state.expiresAt) throw new Error(`Changeset ${state.changesetId} has expired before publication`);
      assertQuota(await inventoryAndCollect(state.cache), state);
      await io.beforePairPublication(prepared);
      state = preparedState(prepared);
      if (now() >= state.expiresAt) throw new Error(`Changeset ${state.changesetId} has expired before publication`);
      assertQuota(await inventoryAndCollect(state.cache), state);
      let changesetIdentity;
      let signatureIdentity;
      try {
        changesetIdentity = await publishHalf(
          state.cache,
          prepared.changesetPath,
          state.changesetBytes,
          (identity) => {
            changesetIdentity = identity;
          }
        );
        state = preparedState(prepared);
      } catch (error) {
        await cleanupPublicationFailure(state.cache, error, [changesetIdentity]);
      }
      try {
        signatureIdentity = await publishHalf(
          state.cache,
          prepared.signaturePath,
          state.signatureBytes,
          (identity) => {
            signatureIdentity = identity;
          }
        );
        state = preparedState(prepared);
      } catch (error) {
        await cleanupPublicationFailure(state.cache, error, [signatureIdentity, changesetIdentity]);
      }
      try {
        const changesetMetadata = await cacheFileMetadata(
          state.cache,
          prepared.changesetPath,
          "Persisted changeset",
          limits.changesets.maxChangesetBytes
        );
        const signatureMetadata = await cacheFileMetadata(
          state.cache,
          prepared.signaturePath,
          "Changeset signature",
          limits.changesets.maxSignatureBytes
        );
        assertIdentityEqual(changesetIdentity, changesetMetadata.identity);
        assertIdentityEqual(signatureIdentity, signatureMetadata.identity);
        const loaded = await authenticatePair(state.cache, state.changesetId, changesetMetadata, signatureMetadata, {
          expectedRoot: state.root,
          allowExpired: false,
          now: now()
        }, io.beforeBoundedReadFinalValidation);
        if (!loaded.changesetBytes.equals(state.changesetBytes) || !loaded.signatureBytes.equals(state.signatureBytes)) {
          throw new Error("Published changeset pair bytes do not match the prepared pair");
        }
      } catch (error) {
        await cleanupPublicationFailure(state.cache, error, [signatureIdentity, changesetIdentity]);
      }
    });
  }
  async function loadAuthenticated(root, changesetId) {
    const cache = await secureCache(root);
    return withCacheStoreLock(cache.root, async () => {
      await reconcileExactRemovalIntents(cache);
      const primaryPath = changesetPath(cache, changesetId);
      const macPath = signaturePath(cache, changesetId);
      let changesetMetadata;
      try {
        changesetMetadata = await cacheFileMetadata(cache, primaryPath, "Persisted changeset", limits.changesets.maxChangesetBytes);
      } catch (error) {
        if (error.code === "ENOENT") {
          throw new Error(`Changeset ${changesetId} is missing or not found`);
        }
        throw error;
      }
      let signatureMetadata;
      try {
        signatureMetadata = await cacheFileMetadata(cache, macPath, "Changeset signature", limits.changesets.maxSignatureBytes);
      } catch (error) {
        if (error.code === "ENOENT") throw new Error("Changeset signature is missing");
        throw error;
      }
      return authenticatePair(cache, changesetId, changesetMetadata, signatureMetadata, {
        expectedRoot: root,
        allowExpired: false,
        now: now()
      }, io.beforeBoundedReadFinalValidation);
    });
  }
  async function consumePair(loaded) {
    await withCacheStoreLock(loaded.cache.root, async () => {
      const [changesetPresent, signaturePresent] = await Promise.all([
        pathPresent(loaded.changesetPath),
        pathPresent(loaded.signaturePath)
      ]);
      if (!changesetPresent && !signaturePresent) return;
      if (!changesetPresent || !signaturePresent) {
        throw new Error("Authenticated changeset pair became incomplete before exact consumption");
      }
      await validatePairIdentities(loaded.cache, loaded);
      const currentChangeset = await cacheFileMetadata(
        loaded.cache,
        loaded.changesetPath,
        "Persisted changeset",
        limits.changesets.maxChangesetBytes
      );
      const currentSignature = await cacheFileMetadata(
        loaded.cache,
        loaded.signaturePath,
        "Changeset signature",
        limits.changesets.maxSignatureBytes
      );
      assertIdentityEqual(loaded.changesetIdentity, currentChangeset.identity);
      assertIdentityEqual(loaded.signatureIdentity, currentSignature.identity);
      const reloaded = await authenticatePair(
        loaded.cache,
        loaded.changeset.changesetId,
        currentChangeset,
        currentSignature,
        {
          expectedRoot: loaded.changeset.root,
          allowExpired: true,
          now: now()
        },
        io.beforeBoundedReadFinalValidation
      );
      if (!reloaded.changesetBytes.equals(loaded.changesetBytes) || !reloaded.signatureBytes.equals(loaded.signatureBytes)) {
        throw new Error("Changeset pair bytes changed before exact consumption");
      }
      await removeExactPair(loaded.cache, loaded.changesetIdentity, loaded.signatureIdentity, io.removeExactFile);
    });
  }
  async function collectGarbage(root) {
    const cache = await secureCache(root);
    await withCacheStoreLock(cache.root, async () => {
      await inventoryAndCollect(cache);
    });
  }
  return { loadAuthenticated, preparePublication, publishPair, consumePair, collectGarbage };
}

// src/transactions.ts
var managedRoots = ["docs/project-design", ".agents/skills/project-design-context"];
var managedClose = "<!-- /project-design-keeper:managed -->";
function pathHash(contents) {
  return contents === void 0 ? null : sha256(contents);
}
function equalOptionalBytes(left, right) {
  return left === void 0 ? right === void 0 : right !== void 0 && left.equals(right);
}
function projectFileReadBudget(label, maxFileBytes, maxAggregateBytes, maxFiles, deadlineMs) {
  return {
    label,
    maxFileBytes,
    files: new CounterBudget(`${label} files`, maxFiles),
    accountedFiles: /* @__PURE__ */ new Set(),
    aggregate: new ByteBudget(label, maxAggregateBytes),
    deadline: new DeadlineBudget(label, deadlineMs)
  };
}
function canonicalRelativePath(requestedPath) {
  if (!requestedPath || isAbsolute5(requestedPath) || win322.isAbsolute(requestedPath)) {
    throw new Error("Output path must be repository-relative");
  }
  const rawParts = requestedPath.replaceAll("\\", "/").split("/");
  const parts = [];
  for (const rawPart of rawParts) {
    if (rawPart === ".") continue;
    if (!rawPart) throw new Error("Output path contains an invalid Windows path component");
    if (rawPart === "..") throw new Error("Output path traversal is not allowed");
    parts.push(rawPart);
  }
  const requestedCanonical = parts.join("/");
  if (!safeRepositoryPath(requestedCanonical)) throw new Error("Output path contains an invalid Windows path component");
  const lower = parts.map((part) => part.toLocaleLowerCase("en-US"));
  const managedRoot = managedRoots.find((candidate) => {
    const rootParts2 = candidate.split("/");
    return rootParts2.every((part, index2) => lower[index2] === part.toLocaleLowerCase("en-US")) && parts.length > rootParts2.length;
  });
  if (!managedRoot) throw new Error("Output path is outside managed project-design locations");
  const rootParts = managedRoot.split("/");
  const canonicalParts = [...rootParts, ...parts.slice(rootParts.length)];
  const path = canonicalParts.join("/");
  return { path, key: windowsRepositoryPathKey(path), managedRoot };
}
async function optionalLstat2(path) {
  try {
    return await lstat9(path);
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
async function validateManagedRoots(root) {
  const repositoryRoot = await realpath7(root);
  for (const managedRoot of managedRoots) {
    let current = repositoryRoot;
    for (const part of managedRoot.split("/")) {
      current = join7(current, part);
      const metadata = await optionalLstat2(current);
      if (!metadata) break;
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw new Error(`Managed root contains a symbolic-link, junction, reparse, or non-directory component: ${managedRoot}`);
      }
      const canonical2 = await realpath7(current);
      if (!isInside(repositoryRoot, canonical2) || !sameFilesystemPath(canonical2, current)) {
        throw new Error(`Managed root resolves outside its repository or lexical root: ${managedRoot}`);
      }
    }
  }
  const manifestPath = join7(repositoryRoot, "docs", "project-design", "manifest.json");
  const manifestMetadata = await optionalLstat2(manifestPath);
  if (manifestMetadata) {
    if (manifestMetadata.isSymbolicLink() || !manifestMetadata.isFile()) {
      throw new Error("Project design manifest must be an ordinary file, not a symbolic link, junction, reparse point, or directory");
    }
    const canonicalManifest = await realpath7(manifestPath);
    if (!isInside(repositoryRoot, canonicalManifest) || !sameFilesystemPath(canonicalManifest, manifestPath)) {
      throw new Error("Project design manifest resolves outside its repository path");
    }
  }
}
async function rejectSymlinkComponents(root, relativePath) {
  let current = root;
  for (const part of relativePath.split("/")) {
    current = join7(current, part);
    const metadata = await optionalLstat2(current);
    if (metadata?.isSymbolicLink()) throw new Error(`Output path contains a symbolic-link component: ${relativePath}`);
  }
}
async function canonicalOutput(root, requestedPath) {
  await validateManagedRoots(root);
  const canonical2 = canonicalRelativePath(requestedPath);
  const target = resolve7(root, ...canonical2.path.split("/"));
  const managedRootPath = resolve7(root, ...canonical2.managedRoot.split("/"));
  if (!isInside(root, target)) throw new Error("Output path escapes the repository root");
  await rejectSymlinkComponents(root, canonical2.path);
  const managedRootMetadata = await optionalLstat2(managedRootPath);
  if (managedRootMetadata) {
    const realManagedRoot = await realpath7(managedRootPath);
    let existing = target;
    for (; ; ) {
      const metadata = await optionalLstat2(existing);
      if (metadata) {
        const realExisting = await realpath7(existing);
        if (!isInside(realManagedRoot, realExisting)) throw new Error("Output path resolves outside the real managed root");
        break;
      }
      existing = dirname5(existing);
      if (!isInside(managedRootPath, existing)) break;
    }
  }
  return { path: canonical2.path, key: canonical2.key, target };
}
function requestedChanges(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error("At least one output change is required");
  return value.map((item, index2) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) throw new Error(`Change ${index2} is invalid`);
    const input = item;
    if (typeof input.path !== "string") throw new Error(`Change ${index2} path is required`);
    const managed = input.managedBlock;
    const managedValue = typeof managed === "object" && managed !== null && !Array.isArray(managed) ? managed : void 0;
    const managedBlock2 = managedValue && typeof managedValue.recordId === "string" && typeof managedValue.content === "string" ? { recordId: managedValue.recordId, content: managedValue.content } : managedValue && typeof managedValue.recordId === "string" && managedValue.delete === true ? { recordId: managedValue.recordId, delete: true } : void 0;
    const variants = [typeof input.content === "string", input.delete === true, Boolean(managedBlock2)].filter(Boolean).length;
    if (variants !== 1) throw new Error(`Change ${index2} must specify exactly one of content, delete, or managedBlock`);
    if (managedBlock2 && !stableId.safeParse(managedBlock2.recordId).success) throw new Error(`Change ${index2} recordId is not stable`);
    return {
      path: input.path,
      ...typeof input.content === "string" ? { content: input.content } : {},
      ...input.delete === true ? { delete: true } : {},
      ...managedBlock2 ? { managedBlock: managedBlock2 } : {},
      ...typeof input.expectedContentHash === "string" ? { expectedContentHash: input.expectedContentHash } : {}
    };
  });
}
function redundancyDecisions(value) {
  if (value === void 0) return void 0;
  if (!Array.isArray(value) || value.length === 0) throw new Error("At least one redundancy decision is required");
  return value.map((item, index2) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Redundancy decision ${index2} is invalid`);
    const decision = item;
    if (typeof decision.candidateId !== "string" || !["merge", "keep-separate", "defer"].includes(String(decision.decision))) {
      throw new Error(`Redundancy decision ${index2} is invalid`);
    }
    if (decision.survivorId !== void 0 && typeof decision.survivorId !== "string") {
      throw new Error(`Redundancy decision ${index2} survivorId is invalid`);
    }
    return {
      candidateId: decision.candidateId,
      decision: decision.decision,
      ...typeof decision.survivorId === "string" ? { survivorId: decision.survivorId } : {}
    };
  });
}
function escapedRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
function parseManagedDocument(contents) {
  const expression = /<!-- project-design-keeper:managed record-id="([A-Za-z0-9][A-Za-z0-9._:-]*)" content-hash="(sha256:[a-f0-9]{64})" -->([\s\S]*?)<!-- \/project-design-keeper:managed -->/gu;
  const derivedExpression = /<!-- project-design-keeper:derived document-id="([A-Za-z0-9][A-Za-z0-9._:-]*)" content-hash="(sha256:[a-f0-9]{64})" -->([\s\S]*?)<!-- \/project-design-keeper:derived -->/gu;
  const blockIds = /* @__PURE__ */ new Set();
  const derivedIds = /* @__PURE__ */ new Set();
  const spans = [];
  let match;
  while ((match = expression.exec(contents)) !== null) {
    if (blockIds.has(match[1])) return { valid: false, fullyOwned: false, blockIds, derivedIds, conflict: `Duplicate managed block: ${match[1]}` };
    if (sha256(Buffer.from(match[3], "utf8")) !== match[2]) {
      return { valid: false, fullyOwned: false, blockIds, derivedIds, conflict: `Managed block ${match[1]} content hash does not match its marker` };
    }
    blockIds.add(match[1]);
    spans.push([match.index, match.index + match[0].length]);
  }
  while ((match = derivedExpression.exec(contents)) !== null) {
    if (derivedIds.has(match[1])) return { valid: false, fullyOwned: false, blockIds, derivedIds, conflict: `Duplicate derived block: ${match[1]}` };
    if (sha256(Buffer.from(match[3], "utf8")) !== match[2]) {
      return { valid: false, fullyOwned: false, blockIds, derivedIds, conflict: `Derived block ${match[1]} content hash does not match its marker` };
    }
    derivedIds.add(match[1]);
    spans.push([match.index, match.index + match[0].length]);
  }
  spans.sort((left, right) => left[0] - right[0]);
  let surrounding = "";
  let offset = 0;
  for (const [start, end] of spans) {
    surrounding += contents.slice(offset, start);
    offset = end;
  }
  surrounding += contents.slice(offset);
  if (surrounding.includes("project-design-keeper:managed") || surrounding.includes("project-design-keeper:derived")) {
    return { valid: false, fullyOwned: false, blockIds, derivedIds, conflict: "Malformed managed or derived marker" };
  }
  const ownedBlocks = blockIds.size + derivedIds.size;
  return { valid: ownedBlocks > 0, fullyOwned: ownedBlocks > 0 && surrounding.trim() === "", blockIds, derivedIds };
}
function hasOwnedMachineSchema(contents) {
  try {
    const value = JSON.parse(contents.toString("utf8"));
    return typeof value === "object" && value !== null && !Array.isArray(value) && value.managedBy === "project-design-keeper" && (value.schemaVersion === "1.0" || value.schemaVersion === "2.0" || value.schemaVersion === "3.0");
  } catch {
    return false;
  }
}
function parseCandidateManifest(contents) {
  try {
    const value = JSON.parse(contents.toString("utf8"));
    return typeof value === "object" && value !== null && !Array.isArray(value) && value.managedBy === "project-design-keeper" && typeof value.schemaVersion === "string" ? value : void 0;
  } catch {
    return void 0;
  }
}
function conflictValidation(conflicts) {
  return {
    valid: false,
    errors: conflicts.map((message) => ({
      code: /content hash/iu.test(message) ? "managed_block_hash_mismatch" : "candidate_conflict",
      path: "changes",
      message
    })),
    warnings: []
  };
}
var keeperSkillPathKey = windowsRepositoryPathKey(".agents/skills/project-design-context/SKILL.md");
function keeperSkillOwnership(contents) {
  const lines = contents.split("\n");
  if (lines.length < 7 || lines[0] !== "---" || lines[1] !== "name: project-design-context" || !lines[2].startsWith("description: ") || lines[3] !== "metadata:" || lines[4] !== "  managed-by: project-design-keeper" || lines[5] !== "---") {
    return { owned: false, fullyOwned: false, conflict: "Keeper Skill must use the unique canonical frontmatter envelope" };
  }
  const encodedDescription = lines[2].slice("description: ".length);
  let description;
  try {
    description = JSON.parse(encodedDescription);
  } catch {
    return { owned: false, fullyOwned: false, conflict: "Keeper Skill description must be a canonical JSON string literal" };
  }
  if (typeof description !== "string" || JSON.stringify(description) !== encodedDescription || description.length === 0 || description.length > 1024 || /[<>]/u.test(description) || !/^Use when\s+\S/iu.test(description) || /(?:follow these steps|step-by-step|rewrite the project files)/iu.test(description)) {
    return { owned: false, fullyOwned: false, conflict: "Keeper Skill description must be nonempty trigger semantics only" };
  }
  const body = lines.slice(6).join("\n");
  const parsedBody = parseManagedDocument(body);
  if (!parsedBody.valid || !parsedBody.fullyOwned || parsedBody.derivedIds.size > 0) {
    return { owned: false, fullyOwned: false, conflict: parsedBody.conflict ?? "Keeper Skill body must contain only legal managed blocks" };
  }
  return { owned: true, fullyOwned: true };
}
function ownership(path, contents) {
  if (windowsRepositoryPathKey(path) === keeperSkillPathKey) return keeperSkillOwnership(contents.toString("utf8"));
  if (path.toLocaleLowerCase("en-US").endsWith(".jsonl")) {
    const archivePath = windowsRepositoryPathKey(path).startsWith("docs/project-design/archive/");
    try {
      const values = decodeCanonicalJsonLines(contents, `Keeper archive output ${path}`).map(({ value }) => value);
      const generation = /\/generation-[0-9]{6}\.records\.jsonl$/u.test(windowsRepositoryPathKey(path));
      const tombstones = windowsRepositoryPathKey(path) === windowsRepositoryPathKey("docs/project-design/archive/tombstones.jsonl");
      const valid = archivePath && values.every((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        const item = value;
        return generation ? Boolean(item.record && typeof item.record === "object" && typeof item.contentHash === "string" && typeof item.archivedAt === "string") : tombstones && typeof item.id === "string" && typeof item.contentHash === "string" && typeof item.archivedAt === "string";
      });
      return { owned: valid, fullyOwned: valid, ...valid ? {} : { conflict: "JSONL output is not a valid Keeper archive" } };
    } catch {
      return { owned: false, fullyOwned: false, conflict: "JSONL output is not a valid Keeper archive" };
    }
  }
  if (path.toLocaleLowerCase("en-US").endsWith(".json")) {
    const owned = hasOwnedMachineSchema(contents);
    return { owned, fullyOwned: owned, ...owned ? {} : { conflict: "JSON output lacks explicit Keeper ownership/schema" } };
  }
  const parsed = parseManagedDocument(contents.toString("utf8"));
  return {
    owned: parsed.valid,
    fullyOwned: parsed.fullyOwned,
    ...!parsed.valid ? { conflict: parsed.conflict ?? "Markdown output has no structurally valid managed block" } : {}
  };
}
function creationOwnership(path, contents) {
  const candidate = ownership(path, contents);
  const machine = /\.jsonl?$/iu.test(path);
  const markdown = !machine;
  const allowed = markdown ? candidate.fullyOwned : candidate.owned;
  return {
    allowed,
    ...!allowed ? { conflict: candidate.conflict ?? "new Markdown must contain only structurally valid managed blocks" } : {}
  };
}
function managedBlockHashes(contents) {
  const text = typeof contents === "string" ? contents : contents.toString("utf8");
  return new Map([...text.matchAll(
    /<!-- project-design-keeper:managed record-id="([A-Za-z0-9][A-Za-z0-9._:-]*)" content-hash="(sha256:[a-f0-9]{64})" -->/gu
  )].map((match) => [match[1], match[2]]));
}
function derivedReplacementAllowed(original, candidate, migratingToV2, allowSchemaMigrationRegrouping = false) {
  const before = parseManagedDocument(original.toString("utf8"));
  const after = parseManagedDocument(candidate.toString("utf8"));
  if (!before.valid || !before.fullyOwned || !after.valid || !after.fullyOwned || after.derivedIds.size !== 1) {
    return false;
  }
  if (before.blockIds.size === 0 && before.derivedIds.size === 1 && after.blockIds.size === 0) {
    return [...before.derivedIds][0] === [...after.derivedIds][0];
  }
  if (allowSchemaMigrationRegrouping && migratingToV2 && before.blockIds.size > 0) return true;
  if (!migratingToV2 || before.blockIds.size === 0 || before.derivedIds.size !== 0) return false;
  if (after.blockIds.size === 0) return true;
  if (before.blockIds.size !== after.blockIds.size) return false;
  const beforeHashes = managedBlockHashes(original);
  const afterHashes = managedBlockHashes(candidate);
  return [...beforeHashes].every(([id, fingerprint2]) => afterHashes.get(id) === fingerprint2);
}
async function migrationPreservationDiagnostics(root, currentPack, candidatePack, overlay, readCurrentDocument) {
  if (!(/* @__PURE__ */ new Set(["1.0", "2.0"])).has(String(currentPack.schemaVersion)) || candidatePack.schemaVersion !== "3.0") return [];
  const diagnostics = [];
  const normalizedOverlay = new Map([...overlay].map(([path, contents]) => [windowsRepositoryPathKey(path), contents]));
  const documentBlocks = async (pack, candidate) => {
    const blocks = /* @__PURE__ */ new Map();
    const documents = Array.isArray(pack.documents) ? pack.documents : [];
    for (const [index2, value] of documents.entries()) {
      if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.path !== "string") continue;
      const path = value.path;
      if (!safeRepositoryPath(path, true)) {
        diagnostics.push({ code: "migration_document_invalid", path: `documents.${index2}.path`, message: `Migration document path is unsafe: ${path}` });
        continue;
      }
      let contents;
      const key = windowsRepositoryPathKey(path);
      if (candidate && normalizedOverlay.has(key)) contents = normalizedOverlay.get(key);
      else contents = await readCurrentDocument(path);
      if (!contents) {
        diagnostics.push({ code: "migration_document_missing", path, message: `Migration document is missing: ${path}` });
        continue;
      }
      for (const [id, fingerprint2] of managedBlockHashes(contents)) {
        if (blocks.has(id)) diagnostics.push({ code: "migration_record_duplicate", path, message: `Migration record block is duplicated: ${id}` });
        else blocks.set(id, fingerprint2);
      }
    }
    return blocks;
  };
  const currentBlocks = await documentBlocks(currentPack, false);
  const candidateBlocks = await documentBlocks(candidatePack, true);
  const currentRecords = Array.isArray(currentPack.records) ? currentPack.records : [];
  const candidateRecords = new Map((Array.isArray(candidatePack.records) ? candidatePack.records : []).filter((value) => Boolean(value) && typeof value === "object" && !Array.isArray(value) && typeof value.id === "string").map((record) => [record.id, record]));
  const preservedFields = ["domain", "scope", "statement", "impact", "strength", "approval", "supersedes", "supersededBy"];
  for (const [index2, value] of currentRecords.entries()) {
    if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.id !== "string") continue;
    const record = value;
    const id = record.id;
    const candidate = candidateRecords.get(id);
    if (!candidate) {
      diagnostics.push({ code: "migration_record_missing", path: `records.${index2}.id`, message: `Schema migration must preserve record ${id}` });
      continue;
    }
    if (!currentBlocks.has(id) || candidateBlocks.get(id) !== currentBlocks.get(id)) {
      diagnostics.push({ code: "migration_managed_body_changed", path: `records.${index2}.id`, message: `Schema migration must preserve the exact managed body for ${id}` });
    }
    for (const field of preservedFields) {
      if (!isDeepStrictEqual(candidate[field], record[field])) {
        diagnostics.push({ code: "migration_record_changed", path: `records.${index2}.${field}`, message: `Schema migration must preserve ${field} for ${id}` });
      }
    }
    if (candidate.assertedConfidence !== record.confidence) {
      diagnostics.push({ code: "migration_confidence_changed", path: `records.${index2}.assertedConfidence`, message: `Schema migration must preserve asserted confidence for ${id}` });
    }
    if (!isDeepStrictEqual(candidate.legacyEvidence, record.evidence)) {
      diagnostics.push({ code: "migration_evidence_history_missing", path: `records.${index2}.legacyEvidence`, message: `Schema migration must retain legacy evidence for ${id}` });
    }
    if (candidate.legacyStatus !== record.status) {
      diagnostics.push({ code: "migration_status_history_missing", path: `records.${index2}.legacyStatus`, message: `Schema migration must retain legacy status for ${id}` });
    }
    if (record.status === "superseded") {
      const lifecycle = candidate.lifecycle;
      const terminal = lifecycle && typeof lifecycle === "object" && !Array.isArray(lifecycle) ? lifecycle : void 0;
      if (terminal?.state !== "terminal" || terminal.reason !== "superseded" || terminal.confirmedRefreshes !== 1) {
        diagnostics.push({
          code: "migration_terminal_lifecycle_invalid",
          path: `records.${index2}.lifecycle`,
          message: `A legacy superseded record must migrate as terminal with one confirmed refresh: ${id}`
        });
      }
    }
  }
  return diagnostics;
}
function mergeManagedBlock(original, block, expectedHash) {
  const recordId = escapedRegularExpression(block.recordId);
  const expression = new RegExp(
    `<!-- project-design-keeper:managed record-id="${recordId}" content-hash="(sha256:[a-f0-9]{64})" -->([\\s\\S]*?)${escapedRegularExpression(managedClose)}`,
    "u"
  );
  const parsed = parseManagedDocument(original);
  if (original && !parsed.valid) return { conflict: parsed.conflict ?? `Managed block ${block.recordId} is in an unmanaged document` };
  const match = expression.exec(original);
  const opener = `<!-- project-design-keeper:managed record-id="${block.recordId}"`;
  if (match) {
    const actual = sha256(Buffer.from(match[2], "utf8"));
    if (actual !== match[1]) return { conflict: `Managed block ${block.recordId} content hash does not match its marker` };
    if (expectedHash && expectedHash !== actual) return { conflict: `Managed block ${block.recordId} differs from the expected content hash` };
    if ("delete" in block) {
      return { content: `${original.slice(0, match.index)}${original.slice(match.index + match[0].length)}` };
    }
    const replacement2 = `${opener} content-hash="${sha256(Buffer.from(block.content, "utf8"))}" -->${block.content}${managedClose}`;
    return { content: `${original.slice(0, match.index)}${replacement2}${original.slice(match.index + match[0].length)}` };
  }
  if ("delete" in block) return { conflict: `Managed block ${block.recordId} does not exist` };
  if (expectedHash) return { conflict: `Managed block ${block.recordId} does not exist for the expected content hash` };
  const replacement = `${opener} content-hash="${sha256(Buffer.from(block.content, "utf8"))}" -->${block.content}${managedClose}`;
  if (!original) return { content: replacement };
  return { content: `${original}${original.endsWith("\n") ? "" : "\n"}${replacement}` };
}
async function manifestFingerprint(root, budget) {
  await validateManagedRoots(root);
  const repositoryRoot = await realpath7(root);
  const manifestPath = join7(repositoryRoot, "docs", "project-design", "manifest.json");
  const contents = await boundedOptionalProjectRead(
    repositoryRoot,
    manifestPath,
    "docs/project-design/manifest.json",
    budget
  );
  return pathHash(contents);
}
async function sourceFingerprint(source, options, budget) {
  if (!source.root) throw new Error("Source fingerprint requires a repository root");
  await validateManagedRoots(source.root);
  return Object.fromEntries(Object.entries((await snapshotForFingerprint(source, options, budget)).files).map(([path, fingerprint2]) => [path.replaceAll("\\", "/"), fingerprint2]));
}
function createExactSourceReadBudget(limits) {
  return {
    count: new CounterBudget("Source file reads", limits.scan.maxFiles),
    reads: projectFileReadBudget(
      "Source file reads",
      limits.scan.maxFileBytes,
      limits.scan.maxAggregateBytes,
      limits.scan.maxFiles,
      limits.scan.deadlineMs
    )
  };
}
async function exactSourceFingerprint(root, paths, budget) {
  await validateManagedRoots(root);
  const entries = [];
  for (const path of [...paths].sort()) {
    budget.count.consume();
    budget.reads.deadline.check();
    if (!safeRepositoryPath(path)) throw new Error(`Source path is unsafe: ${path}`);
    const target = resolve7(root, ...path.split("/"));
    const contents = await boundedOptionalProjectRead(root, target, `source:${path}`, budget.reads);
    if (contents) entries.push([path, pathHash(contents)]);
  }
  return Object.fromEntries(entries);
}
function equalFingerprints(left, right) {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index2) => key === rightKeys[index2] && left[key] === right[key]);
}
async function unmanagedOutputs(root, limits, readBudget2, beforeEntry) {
  await validateManagedRoots(root);
  const directory = join7(root, "docs", "project-design");
  if (!await optionalLstat2(directory)) return [];
  const unmanaged = [];
  const entries = new CounterBudget("Project-design output inventory entries", Math.min(limits.scan.maxFiles, 4096));
  const maximumDepth = 16;
  async function visit(current, depth) {
    readBudget2.deadline.check();
    if (depth > maximumDepth) {
      throw new Error(`Project-design output inventory depth exceeds the limit of ${maximumDepth} levels`);
    }
    await captureProjectPathEvidence(root, current, "directory", relative5(root, current).replaceAll("\\", "/"));
    const handle = await opendir6(current);
    const children = [];
    for await (const entry of handle) {
      readBudget2.deadline.check();
      entries.consume();
      children.push(entry);
    }
    children.sort((left, right) => left.name.localeCompare(right.name, "en-US"));
    for (const entry of children) {
      const path = join7(current, entry.name);
      const relativePath = relative5(root, path).replaceAll("\\", "/");
      if (beforeEntry) await beforeEntry(path, entry.isDirectory() ? "directory" : "file");
      if (entry.isDirectory()) {
        await visit(path, depth + 1);
        continue;
      }
      if (entry.isSymbolicLink() || !entry.isFile()) {
        unmanaged.push(relativePath);
        continue;
      }
      const contents = await boundedOptionalProjectRead(root, path, relativePath, readBudget2);
      const fileOwnership = contents ? ownership(relativePath, contents) : { owned: false, conflict: "unreadable output" };
      if (!fileOwnership.owned) unmanaged.push(`${relativePath}: ${fileOwnership.conflict ?? "missing Keeper ownership"}`);
    }
  }
  await visit(directory, 0);
  return unmanaged.sort();
}
function normativeRecordIds(pack) {
  if (!pack || !Array.isArray(pack.records)) return [];
  return pack.records.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const record = candidate;
    return typeof record.id === "string" && (record.strength === "required" || record.strength === "preferred") && record.approval === "confirmed" ? [record.id] : [];
  });
}
function semanticDecisionIds(currentPack, candidatePack, decisions) {
  const currentNormative = new Set(normativeRecordIds(currentPack));
  const newlyNormative = normativeRecordIds(candidatePack).filter((id) => !currentNormative.has(id));
  const merges = decisions?.flatMap((decision) => decision.decision === "merge" ? [decision.candidateId] : []) ?? [];
  return [.../* @__PURE__ */ new Set([...newlyNormative, ...merges])].sort();
}
function emptyArchiveActions() {
  return { archivedRecordIds: [], tombstonedRecordIds: [] };
}
function objectRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function archiveMetadata(pack) {
  return objectRecord(pack?.archive);
}
function archiveGenerations(pack) {
  const generations2 = archiveMetadata(pack)?.generations;
  return Array.isArray(generations2) ? generations2.flatMap((value) => {
    const generation = objectRecord(value);
    return generation ? [generation] : [];
  }) : [];
}
function tombstoneMetadata(pack) {
  return objectRecord(archiveMetadata(pack)?.tombstones);
}
function packHistoryPaths(pack) {
  const paths = archiveGenerations(pack).flatMap((generation) => typeof generation.path === "string" ? [generation.path] : []);
  const tombstones = tombstoneMetadata(pack);
  if (typeof tombstones?.path === "string") paths.push(tombstones.path);
  return [...new Set(paths)].sort();
}
function actionBearingHistoryPaths(currentPack, candidatePack) {
  const currentGenerationIds = new Set(archiveGenerations(currentPack).flatMap((generation) => typeof generation.id === "string" ? [generation.id] : []));
  const paths = archiveGenerations(candidatePack).flatMap((generation) => typeof generation.id === "string" && typeof generation.path === "string" && !currentGenerationIds.has(generation.id) ? [generation.path] : []);
  const currentTombstones = tombstoneMetadata(currentPack);
  const candidateTombstones = tombstoneMetadata(candidatePack);
  if (typeof candidateTombstones?.path === "string" && Number(candidateTombstones.count) > Number(currentTombstones?.count ?? 0)) {
    paths.push(candidateTombstones.path);
  }
  return [...new Set(paths)].sort();
}
function jsonLineObjects(bytes, expectedCount, label) {
  if (!bytes) {
    if (expectedCount === 0) return [];
    throw new Error(`${label} is missing`);
  }
  return decodeCanonicalJsonLines(bytes, label, { expectedCount }).map(({ value }) => {
    const record = objectRecord(value);
    if (!record) throw new Error("Validated archive history could not be summarized for approval");
    return record;
  });
}
async function referencedArchiveRecordIds(pack, read) {
  const ids = /* @__PURE__ */ new Set();
  for (const generation of archiveGenerations(pack)) {
    if (!generation || typeof generation.path !== "string") continue;
    const entries = jsonLineObjects(
      await read(generation.path),
      generation.recordCount,
      `Archive history ${generation.path}`
    );
    for (const entry of entries) {
      const record = objectRecord(entry.record);
      if (typeof record?.id === "string") ids.add(record.id);
    }
  }
  return ids;
}
async function referencedTombstoneIds(pack, read) {
  const tombstones = tombstoneMetadata(pack);
  if (!tombstones || typeof tombstones.path !== "string") return /* @__PURE__ */ new Set();
  const records = jsonLineObjects(
    await read(tombstones.path),
    tombstones.count,
    `Tombstone history ${tombstones.path}`
  );
  return new Set(records.flatMap((record) => typeof record.id === "string" ? [record.id] : []));
}
async function deriveArchiveActions(currentPack, candidatePack, readCurrent, readCandidate) {
  const [currentArchiveIds, candidateArchiveIds, currentTombstoneIds, candidateTombstoneIds] = await Promise.all([
    referencedArchiveRecordIds(currentPack, readCurrent),
    referencedArchiveRecordIds(candidatePack, readCandidate),
    referencedTombstoneIds(currentPack, readCurrent),
    referencedTombstoneIds(candidatePack, readCandidate)
  ]);
  return {
    archivedRecordIds: [...candidateArchiveIds].filter((id) => !currentArchiveIds.has(id)).sort(),
    tombstonedRecordIds: [...candidateTombstoneIds].filter((id) => !currentTombstoneIds.has(id)).sort()
  };
}
function approvalBinding(changeset) {
  if (changeset.sourcePaths && (!changeset.validatedPack || !changeset.validationDependencyDigest)) {
    throw new Error("Candidate changeset predates validation dependency binding; preview the update again");
  }
  const summary = { create: 0, update: 0, delete: 0 };
  for (const change of changeset.changes) {
    if (change.delete) summary.delete += 1;
    else if (change.previousHash) summary.update += 1;
    else summary.create += 1;
  }
  return {
    root: changeset.root,
    changesetId: changeset.changesetId,
    diffDigest: changeset.diffDigest,
    expiresAt: changeset.expiresAt,
    paths: changeset.changes.map((change) => change.path).sort(),
    summary,
    archiveActions: {
      archivedRecordIds: [...changeset.archiveActions.archivedRecordIds],
      tombstonedRecordIds: [...changeset.archiveActions.tombstonedRecordIds]
    },
    semanticDecisionIds: [...changeset.semanticDecisionIds]
  };
}
async function persistJson(cache, path, value) {
  await publishExclusiveFile(cache, path, `${JSON.stringify(value, null, 2)}
`);
}
async function resolveChangesetRequest(input) {
  const adapter = typeof input.changeset === "object" && input.changeset !== null ? input.changeset : void 0;
  const changesetId = typeof input.changesetId === "string" ? input.changesetId : typeof adapter?.changesetId === "string" ? adapter.changesetId : void 0;
  if (!changesetId) throw new Error("A changeset id is required");
  if (typeof input.root !== "string") throw new Error("A repository root is required");
  return {
    changesetId,
    root: (await resolveScope({ root: input.root, path: "." })).root
  };
}
function summaryFor(changes) {
  return changes.map((change) => `${change.delete ? "delete" : change.previousHash ? "update" : "create"} ${change.path}`).join("\n");
}
function diffLines(contents) {
  if (contents === void 0) return { lines: [], terminated: true };
  const text = Buffer.isBuffer(contents) ? contents.toString("utf8") : contents;
  const terminated = text.endsWith("\n");
  const lines = text.split(/\r?\n/u);
  if (terminated) lines.pop();
  return { lines, terminated };
}
function emitDiffLines(lines, prefix, terminated) {
  if (lines.length === 0) return "";
  const output = lines.map((line) => `${prefix}${line}
`).join("");
  return terminated ? output : `${output}\\ No newline at end of file
`;
}
function unifiedDiff(changes, originals) {
  return changes.map((change) => {
    const original = originals.get(change.path);
    const next = change.delete ? void 0 : change.content ?? "";
    if (original !== void 0 && next !== void 0 && original.equals(Buffer.from(next, "utf8"))) return "";
    const oldView = diffLines(original);
    const newView = diffLines(next);
    const oldPath = original === void 0 ? "/dev/null" : `a/${change.path}`;
    const newPath = change.delete ? "/dev/null" : `b/${change.path}`;
    const oldStart = oldView.lines.length === 0 ? 0 : 1;
    const newStart = newView.lines.length === 0 ? 0 : 1;
    return [
      `--- ${oldPath}
`,
      `+++ ${newPath}
`,
      `@@ -${oldStart},${oldView.lines.length} +${newStart},${newView.lines.length} @@
`,
      emitDiffLines(oldView.lines, "-", oldView.terminated),
      emitDiffLines(newView.lines, "+", newView.terminated)
    ].join("");
  }).join("");
}
var canonicalUuidPattern2 = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
var recoverySnapshotNamePattern = new RegExp(`^(0|[1-9][0-9]*)-(${canonicalUuidPattern2})-(${canonicalUuidPattern2})\\.json$`, "u");
var recoverySnapshotMaxBytes = keeperLimits.preview.maxAggregateBytes * 3 + keeperLimits.preview.maxChanges * 2048;
var recoverySnapshotMaxObservedFiles = keeperLimits.changesets.maxPairsPerProject;
function exactObject2(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const observed = Object.keys(value).sort((left, right) => left.localeCompare(right, "en-US"));
  const expected = [...keys].sort((left, right) => left.localeCompare(right, "en-US"));
  return observed.length === expected.length && observed.every((key, index2) => key === expected[index2]);
}
function strictBase64(value) {
  const decoded = Buffer.from(value, "base64");
  return decoded.toString("base64") === value ? decoded : void 0;
}
function parseRecoveryFileRecord(value) {
  if (!exactObject2(value, ["existed", "content", "contentBase64", "mode", "type", "hash", "previousHash"])) {
    throw new Error("Recovery file record has an unexpected schema");
  }
  if (value.type === "missing") {
    if (value.existed !== false || value.content !== null || value.contentBase64 !== null || value.mode !== null || value.hash !== null || value.previousHash !== null) {
      throw new Error("Missing recovery file record is inconsistent");
    }
    return value;
  }
  if (value.type !== "file" || value.existed !== true || typeof value.content !== "string" || typeof value.contentBase64 !== "string" || !Number.isSafeInteger(value.mode) || Number(value.mode) < 0 || Number(value.mode) > 511 || typeof value.hash !== "string" || typeof value.previousHash !== "string") {
    throw new Error("Recovery file record is inconsistent");
  }
  const decoded = strictBase64(value.contentBase64);
  if (!decoded || !decoded.equals(Buffer.from(value.content, "utf8")) || sha256(decoded) !== value.hash || value.previousHash !== value.hash) {
    throw new Error("Recovery file record content binding is invalid");
  }
  return value;
}
function parseRecoverySnapshotRecord(value, name2, canonicalRoot, activeChangeset) {
  if (!exactObject2(value, ["version", "root", "changesetId", "createdAt", "files"]) || value.version !== 1 || value.root !== canonicalRoot || typeof value.changesetId !== "string" || !Number.isSafeInteger(value.createdAt) || Number(value.createdAt) < 0 || !value.files || typeof value.files !== "object" || Array.isArray(value.files)) {
    throw new Error("Recovery snapshot has an unexpected schema");
  }
  const match = recoverySnapshotNamePattern.exec(name2);
  if (!match || Number(match[1]) !== value.createdAt || match[2] !== value.changesetId) {
    throw new Error("Recovery snapshot filename does not bind its metadata");
  }
  const files = {};
  for (const [path, fileValue] of Object.entries(value.files)) {
    const canonical2 = canonicalRelativePath(path);
    if (canonical2.path !== path) throw new Error("Recovery snapshot file path is not canonical");
    files[path] = parseRecoveryFileRecord(fileValue);
  }
  if (activeChangeset && value.changesetId === activeChangeset.changesetId) {
    const expectedPaths = activeChangeset.changes.map((change) => change.path).sort((left, right) => left.localeCompare(right, "en-US"));
    const actualPaths = Object.keys(files).sort((left, right) => left.localeCompare(right, "en-US"));
    if (expectedPaths.length !== actualPaths.length || expectedPaths.some((path, index2) => path !== actualPaths[index2])) {
      throw new Error("Active recovery snapshot files do not match the authenticated changeset");
    }
    for (const change of activeChangeset.changes) {
      if (files[change.path].previousHash !== change.previousHash) {
        throw new Error("Active recovery snapshot previousHash does not match the authenticated changeset");
      }
    }
  }
  return {
    version: 1,
    root: value.root,
    changesetId: value.changesetId,
    createdAt: value.createdAt,
    files
  };
}
async function readExactRecoveryBytes(handle, size) {
  if (size < 0n || size > BigInt(recoverySnapshotMaxBytes) || size > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Recovery snapshot exceeds its bounded byte limit");
  }
  const contents = Buffer.alloc(Number(size));
  let offset = 0;
  while (offset < contents.byteLength) {
    const { bytesRead } = await handle.read(contents, offset, contents.byteLength - offset, offset);
    if (!Number.isSafeInteger(bytesRead) || bytesRead <= 0 || bytesRead > contents.byteLength - offset) {
      throw new Error("Recovery snapshot ended during its exact bounded read");
    }
    offset += bytesRead;
  }
  const overflow = Buffer.alloc(1);
  if ((await handle.read(overflow, 0, 1, contents.byteLength)).bytesRead !== 0) {
    throw new Error("Recovery snapshot grew beyond its exact bounded read");
  }
  return contents;
}
async function readRecoverySnapshot(cache, path, name2, canonicalRoot, activeChangeset) {
  try {
    await validateCacheFile(cache, path, false);
    const identity = await captureSecurePathIdentity(cache, path, "file");
    const initial = await lstat9(path, { bigint: true });
    assertSecureOwnerFileMetadata(initial, path, 1n);
    if (initial.dev !== identity.dev || initial.ino !== identity.ino) {
      throw new Error("Recovery snapshot identity changed before open");
    }
    const handle = await open9(path, "r");
    let contents;
    try {
      const opened = await handle.stat({ bigint: true });
      assertSecureOwnerFileMetadata(opened, path, 1n);
      if (!sameProjectMetadata(initial, opened)) throw new Error("Recovery snapshot version changed before read");
      contents = await readExactRecoveryBytes(handle, opened.size);
      const completed = await handle.stat({ bigint: true });
      if (!sameProjectMetadata(opened, completed)) throw new Error("Recovery snapshot version changed during read");
    } finally {
      await handle.close();
    }
    const finalMetadata = await lstat9(path, { bigint: true });
    assertSecureOwnerFileMetadata(finalMetadata, path, 1n);
    if (!sameProjectMetadata(initial, finalMetadata)) throw new Error("Recovery snapshot final pathname version changed");
    await validateSecurePathIdentity(cache, identity);
    let parsed;
    try {
      const serialized = contents.toString("utf8");
      if (!Buffer.from(serialized, "utf8").equals(contents)) throw new Error("non-canonical UTF-8");
      parsed = JSON.parse(serialized);
    } catch {
      throw new Error("Recovery snapshot JSON is invalid");
    }
    const value = parseRecoverySnapshotRecord(parsed, name2, canonicalRoot, activeChangeset);
    return {
      name: name2,
      path,
      createdAt: value.createdAt,
      changesetId: value.changesetId,
      identity,
      metadata: initial,
      contentHash: sha256(contents),
      value
    };
  } catch (error) {
    throw new Error(`Recovery snapshot metadata is invalid: ${name2}`, { cause: error });
  }
}
async function exactRemoveRecoverySnapshot(cache, snapshot2, canonicalRoot) {
  const current = await readRecoverySnapshot(cache, snapshot2.path, snapshot2.name, canonicalRoot);
  if (current.identity.dev !== snapshot2.identity.dev || current.identity.ino !== snapshot2.identity.ino || !sameProjectMetadata(current.metadata, snapshot2.metadata) || current.contentHash !== snapshot2.contentHash) {
    throw new Error(`Recovery snapshot changed before exact retention cleanup: ${snapshot2.name}`);
  }
  await safeRemoveExactCacheFile(cache, snapshot2.identity);
}
async function captureRecoveryFile(changeset, change, index2, hooks) {
  const target = join7(changeset.root, ...change.path.split("/"));
  const metadata = await optionalLstat2(target);
  if (!metadata) {
    if (change.previousHash !== null) throw new Error(`Recovery snapshot target is stale: ${change.path}`);
    const absentSuffix = [target];
    let existingAncestor = dirname5(target);
    while (!sameFilesystemPath(existingAncestor, changeset.root)) {
      const ancestorMetadata = await optionalLstat2(existingAncestor);
      if (ancestorMetadata) {
        if (ancestorMetadata.isSymbolicLink() || !ancestorMetadata.isDirectory()) {
          throw new Error(`Recovery snapshot missing target ancestor is not an ordinary directory: ${change.path}`);
        }
        break;
      }
      absentSuffix.push(existingAncestor);
      existingAncestor = dirname5(existingAncestor);
    }
    const ancestorIdentity = await captureProjectPathIdentity(
      changeset.root,
      existingAncestor,
      "directory",
      change.path
    );
    for (const absent of absentSuffix) {
      if (await optionalLstat2(absent)) throw new Error(`Recovery snapshot missing target changed during capture: ${change.path}`);
    }
    await hooks.beforeRecoveryTargetOpen?.(target, index2);
    for (const absent of absentSuffix) {
      if (await optionalLstat2(absent)) throw new Error(`Recovery snapshot missing target changed during capture: ${change.path}`);
    }
    await validateProjectPathIdentity(changeset.root, ancestorIdentity, change.path);
    return {
      record: {
        existed: false,
        content: null,
        contentBase64: null,
        mode: null,
        type: "missing",
        hash: null,
        previousHash: null
      },
      validate: async () => {
        try {
          await validateProjectPathIdentity(changeset.root, ancestorIdentity, change.path);
          for (const absent of absentSuffix) {
            if (await optionalLstat2(absent)) {
              throw new Error(`Recovery snapshot missing target changed: ${change.path}`);
            }
          }
        } catch (error) {
          throw new Error(`Recovery snapshot missing target evidence changed: ${change.path}`, { cause: error });
        }
      }
    };
  }
  const parent = await captureProjectPathIdentity(changeset.root, dirname5(target), "directory", change.path);
  let captured;
  try {
    captured = await captureProjectPathEvidence(changeset.root, target, "file", change.path, {
      beforeOpen: async () => {
        await hooks.beforeRecoveryTargetOpen?.(target, index2);
      },
      afterOpen: async () => {
        await hooks.afterRecoveryTargetOpen?.(target, index2);
      },
      afterRead: async () => {
        await hooks.afterRecoveryTargetRead?.(target, index2);
      }
    });
  } catch (error) {
    throw new Error(`Recovery snapshot target identity or read is ambiguous: ${change.path}`, { cause: error });
  }
  const contents = captured.contents;
  if (captured.identity.parentDev !== parent.dev || captured.identity.parentIno !== parent.ino || !sameFilesystemPath(captured.identity.parent, parent.path)) {
    throw new Error(`Recovery snapshot target parent identity changed: ${change.path}`);
  }
  await validateProjectPathIdentity(changeset.root, parent, change.path);
  if (captured.identity.contentHash !== change.previousHash) {
    throw new Error(`Recovery snapshot target content is stale: ${change.path}`);
  }
  return {
    record: {
      existed: true,
      content: contents.toString("utf8"),
      contentBase64: contents.toString("base64"),
      mode: Number(captured.identity.mode & 0o777n),
      type: "file",
      hash: captured.identity.contentHash,
      previousHash: change.previousHash
    },
    validate: async () => {
      try {
        await validateProjectPathIdentity(changeset.root, parent, change.path);
        await validateProjectPathIdentity(changeset.root, captured.identity, change.path);
      } catch (error) {
        throw new Error(`Recovery snapshot target evidence changed: ${change.path}`, { cause: error });
      }
    }
  };
}
async function storeRecoverySnapshot(cache, changeset, now, hooks = {}) {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Recovery snapshot timestamp is invalid");
  const canonicalRoot = await realpath7(changeset.root);
  if (!sameFilesystemPath(canonicalRoot, changeset.root)) throw new Error("Recovery snapshot project root is not canonical");
  const files = {};
  const capturedFiles = [];
  for (const [index2, change] of changeset.changes.entries()) {
    const captured = await captureRecoveryFile(changeset, change, index2, hooks);
    files[change.path] = captured.record;
    capturedFiles.push(captured);
  }
  const projectKey = createHash9("sha256").update(canonicalRoot).digest("hex");
  const directory = join7(cache.snapshots, projectKey);
  await createSecureCacheDirectory(cache, directory);
  let names = (await readdir2(directory)).filter((name2) => name2.endsWith(".json"));
  if (names.length > recoverySnapshotMaxObservedFiles) {
    throw new Error("Recovery snapshot directory exceeds its bounded entry limit");
  }
  await validateCacheFiles(cache, names.map((name2) => join7(directory, name2)));
  let snapshots = await Promise.all(names.map((name2) => readRecoverySnapshot(cache, join7(directory, name2), name2, canonicalRoot, changeset)));
  let active = snapshots.filter(({ changesetId }) => changesetId === changeset.changesetId).sort((left, right) => right.createdAt - left.createdAt || right.name.localeCompare(left.name, "en-US"));
  if (active.some((snapshot2) => !isDeepStrictEqual(snapshot2.value.files, files))) {
    throw new Error("Active recovery snapshot does not match the currently authenticated pre-state");
  }
  if (active.length > 1) {
    const authoritative2 = active[0];
    for (const duplicate of active.slice(1)) {
      await exactRemoveRecoverySnapshot(cache, duplicate, canonicalRoot);
    }
    snapshots = snapshots.filter((snapshot2) => snapshot2.changesetId !== changeset.changesetId || snapshot2.name === authoritative2.name);
    active = [authoritative2];
  }
  if (active.length === 0) {
    await hooks.beforeRecoverySnapshotPublish?.(canonicalRoot, changeset.changesetId);
    for (const captured of capturedFiles) await captured.validate();
    const name2 = `${now}-${changeset.changesetId}-${randomUUID3()}.json`;
    const path = join7(directory, name2);
    await persistJson(cache, path, {
      version: 1,
      root: canonicalRoot,
      changesetId: changeset.changesetId,
      createdAt: now,
      files
    });
    const published = await readRecoverySnapshot(cache, path, name2, canonicalRoot, changeset);
    snapshots.push(published);
    active = [published];
  }
  const newest = [...snapshots].sort((left, right) => right.createdAt - left.createdAt || right.name.localeCompare(left.name, "en-US"));
  const retained = new Set(newest.slice(0, 10).map(({ name: name2 }) => name2));
  const authoritative = active[0];
  if (!retained.has(authoritative.name)) {
    const replaceable = newest.filter(({ name: name2, changesetId }) => retained.has(name2) && changesetId !== changeset.changesetId).sort((left, right) => left.createdAt - right.createdAt || left.name.localeCompare(right.name, "en-US"))[0];
    if (!replaceable) throw new Error("Active recovery snapshot retention is ambiguous");
    retained.delete(replaceable.name);
    retained.add(authoritative.name);
  }
  for (const snapshot2 of snapshots) {
    if (!retained.has(snapshot2.name)) await exactRemoveRecoverySnapshot(cache, snapshot2, canonicalRoot);
  }
  names = (await readdir2(directory)).filter((name2) => name2.endsWith(".json"));
  if (names.length > 10) throw new Error("Recovery snapshot retention did not converge to ten files");
  const activeNames = names.filter((name2) => recoverySnapshotNamePattern.exec(name2)?.[2] === changeset.changesetId);
  if (activeNames.length !== 1 || activeNames[0] !== authoritative.name) {
    throw new Error("Active recovery snapshot retention did not converge to one authoritative file");
  }
  for (const captured of capturedFiles) await captured.validate();
}
async function regularFileState(root, path, relativeLabel, budget) {
  const captured = await boundedOptionalProjectEvidence(root, path, relativeLabel, budget);
  if (!captured) return void 0;
  return { contents: captured.contents, mode: Number(captured.identity.mode & 0o777n) };
}
function sameProjectIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.kind === right.kind && left.parentDev === right.parentDev && left.parentIno === right.parentIno && left.uid === right.uid && left.gid === right.gid && left.mode === right.mode && left.nlink === right.nlink && left.size === right.size && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs && sameFilesystemPath(left.path, right.path) && sameFilesystemPath(left.canonicalPath, right.canonicalPath) && sameFilesystemPath(left.parent, right.parent) && left.reparsePoint === right.reparsePoint && left.contentHash === right.contentHash;
}
function sameProjectMetadata(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid && left.gid === right.gid && left.mode === right.mode && left.nlink === right.nlink && left.size === right.size && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs && left.isFile() === right.isFile() && left.isDirectory() === right.isDirectory() && left.isSymbolicLink() === right.isSymbolicLink();
}
function projectIdentityFromMetadata(path, canonicalPath, parent, metadata, parentMetadata, kind, contentHash) {
  return {
    path: resolve7(path),
    canonicalPath,
    parent,
    dev: metadata.dev,
    ino: metadata.ino,
    parentDev: parentMetadata.dev,
    parentIno: parentMetadata.ino,
    uid: metadata.uid,
    gid: metadata.gid,
    mode: metadata.mode,
    nlink: metadata.nlink,
    size: metadata.size,
    mtimeNs: metadata.mtimeNs,
    ctimeNs: metadata.ctimeNs,
    kind,
    reparsePoint: metadata.isSymbolicLink(),
    contentHash
  };
}
async function readExactProjectFile(handle, size, relativeLabel, budget) {
  const maxFileBytes = budget?.maxFileBytes ?? keeperLimits.preview.maxFileBytes;
  if (size < 0n || size > BigInt(maxFileBytes)) {
    throw new Error(`${budget?.label ?? "Output file"} exceeds the per-file limit of ${maxFileBytes} bytes: ${relativeLabel}`);
  }
  const expected = Number(size);
  budget?.deadline.check();
  budget?.aggregate.consume(expected);
  const contents = Buffer.alloc(expected);
  let offset = 0;
  while (offset < expected) {
    budget?.deadline.check();
    const read = await handle.read(contents, offset, Math.min(64 * 1024, expected - offset), offset);
    if (read.bytesRead <= 0) throw new Error(`Output file ended during bounded identity read: ${relativeLabel}`);
    offset += read.bytesRead;
  }
  const overflow = Buffer.alloc(1);
  const eof = await handle.read(overflow, 0, 1, expected);
  if (eof.bytesRead !== 0) throw new Error(`Output file grew during bounded identity read: ${relativeLabel}`);
  return contents;
}
async function captureProjectPathEvidence(root, path, kind, relativeLabel, options = {}) {
  const [canonicalRoot, canonicalPath] = await Promise.all([realpath7(root), realpath7(path)]);
  if (!sameFilesystemPath(path, canonicalPath) || !isInside(canonicalRoot, canonicalPath)) {
    throw new Error(`Output ${kind === "directory" ? "parent" : "target"} containment changed: ${relativeLabel}`);
  }
  const parent = await realpath7(dirname5(canonicalPath));
  const [metadata, parentMetadata] = await Promise.all([
    lstat9(path, { bigint: true }),
    lstat9(parent, { bigint: true })
  ]);
  const reparsePoint = metadata.isSymbolicLink();
  if (reparsePoint || (kind === "directory" ? !metadata.isDirectory() : !metadata.isFile())) {
    throw new Error(`Output ${kind === "directory" ? "parent" : "target"} is not an ordinary ${kind}: ${relativeLabel}`);
  }
  if (parentMetadata.isSymbolicLink() || !parentMetadata.isDirectory()) {
    throw new Error(`Output parent identity is not an ordinary directory: ${relativeLabel}`);
  }
  if (kind === "file" && metadata.nlink !== 1n) {
    throw new Error(`Output file has an unexpected hard-link count: ${relativeLabel}`);
  }
  if (kind === "directory") {
    const [settled2, settledParent2, settledCanonical2] = await Promise.all([
      lstat9(path, { bigint: true }),
      lstat9(parent, { bigint: true }),
      realpath7(path)
    ]);
    if (!sameProjectMetadata(metadata, settled2) || !sameProjectMetadata(parentMetadata, settledParent2) || !sameFilesystemPath(canonicalPath, settledCanonical2)) {
      throw new Error(`Output directory identity changed during capture: ${relativeLabel}`);
    }
    return {
      identity: projectIdentityFromMetadata(
        path,
        canonicalPath,
        parent,
        settled2,
        settledParent2,
        kind,
        null
      )
    };
  }
  await options.beforeOpen?.();
  const handle = options.ownedHandle ?? await open9(path, "r");
  let contents;
  try {
    const before = await handle.stat({ bigint: true });
    if (!sameProjectMetadata(metadata, before) || before.nlink !== 1n || !before.isFile() || before.isSymbolicLink()) {
      throw new Error(`Output file identity changed before bounded read: ${relativeLabel}`);
    }
    await options.afterOpen?.();
    const immediatelyBeforeRead = await handle.stat({ bigint: true });
    if (!sameProjectMetadata(before, immediatelyBeforeRead) || immediatelyBeforeRead.nlink !== 1n) {
      throw new Error(`Output file identity changed after open: ${relativeLabel}`);
    }
    contents = await readExactProjectFile(handle, before.size, relativeLabel, options.readBudget);
    await options.afterRead?.();
    const after = await handle.stat({ bigint: true });
    if (!sameProjectMetadata(before, after) || after.size !== BigInt(contents.byteLength) || after.nlink !== 1n) {
      throw new Error(`Output file identity changed during bounded read: ${relativeLabel}`);
    }
  } finally {
    if (!options.ownedHandle) await handle.close();
  }
  const [settled, settledParent, settledCanonical] = await Promise.all([
    lstat9(path, { bigint: true }),
    lstat9(parent, { bigint: true }),
    realpath7(path)
  ]);
  if (!sameProjectMetadata(metadata, settled) || !sameProjectMetadata(parentMetadata, settledParent) || settled.nlink !== 1n || !sameFilesystemPath(canonicalPath, settledCanonical)) {
    throw new Error(`Output file identity changed after bounded read: ${relativeLabel}`);
  }
  return {
    contents,
    identity: projectIdentityFromMetadata(
      path,
      canonicalPath,
      parent,
      settled,
      settledParent,
      kind,
      pathHash(contents)
    )
  };
}
async function boundedOptionalProjectEvidence(root, path, relativeLabel, budget) {
  budget.deadline.check();
  const key = windowsRepositoryPathKey(relativeLabel.replaceAll("\\", "/"));
  if (!budget.accountedFiles.has(key)) {
    budget.files.consume();
    budget.accountedFiles.add(key);
  }
  const metadata = await optionalLstat2(path);
  if (!metadata) return void 0;
  const captured = await captureProjectPathEvidence(root, path, "file", relativeLabel, { readBudget: budget });
  return { identity: captured.identity, contents: captured.contents };
}
async function boundedOptionalProjectRead(root, path, relativeLabel, budget) {
  return (await boundedOptionalProjectEvidence(root, path, relativeLabel, budget))?.contents;
}
async function captureProjectPathIdentity(root, path, kind, relativeLabel) {
  return (await captureProjectPathEvidence(root, path, kind, relativeLabel)).identity;
}
function sameProjectVersionAcrossRename(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.kind === right.kind && left.uid === right.uid && left.gid === right.gid && left.mode === right.mode && left.nlink === right.nlink && left.size === right.size && left.mtimeNs === right.mtimeNs && left.reparsePoint === right.reparsePoint && left.contentHash === right.contentHash;
}
function sameDirectoryAcrossOwnedMutation(left, right, expectedChildDirectoryLinkDelta = 0n) {
  return left.kind === "directory" && right.kind === "directory" && left.dev === right.dev && left.ino === right.ino && left.parentDev === right.parentDev && left.parentIno === right.parentIno && left.uid === right.uid && left.gid === right.gid && left.mode === right.mode && right.nlink === left.nlink + expectedChildDirectoryLinkDelta && left.reparsePoint === right.reparsePoint && sameFilesystemPath(left.path, right.path) && sameFilesystemPath(left.canonicalPath, right.canonicalPath) && sameFilesystemPath(left.parent, right.parent);
}
function parentLinkDeltaForOwnedChildDirectory(child, direction, relativeLabel) {
  if (process.platform === "win32") return 0n;
  if (child.kind !== "directory") throw new Error(`Owned child is not a directory: ${relativeLabel}`);
  if (child.nlink === 1n) return 0n;
  if (child.nlink === 2n) return direction;
  throw new Error(`Owned child directory link-count semantics are ambiguous: ${relativeLabel}`);
}
async function validateProjectPathIdentity(root, identity, relativeLabel) {
  let current;
  try {
    current = await captureProjectPathIdentity(root, identity.path, identity.kind, relativeLabel);
  } catch (error) {
    throw new Error(`Output ${identity.kind === "directory" ? "parent" : "file"} identity changed: ${relativeLabel}`, { cause: error });
  }
  if (!sameProjectIdentity(identity, current)) {
    throw new Error(`Output ${identity.kind === "directory" ? "parent" : "file"} identity changed: ${relativeLabel}`);
  }
}
async function optionalCapturedRegularFileState(root, path, parentIdentity, relativeLabel) {
  let first;
  try {
    first = await lstat9(path, { bigint: true });
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
  if (first.isSymbolicLink() || !first.isFile()) {
    throw new Error(`Output target is not an ordinary regular file: ${relativeLabel}`);
  }
  await validateProjectPathIdentity(root, parentIdentity, relativeLabel);
  const captured = await captureProjectPathEvidence(root, path, "file", relativeLabel);
  const identity = captured.identity;
  if (identity.parentDev !== parentIdentity.dev || identity.parentIno !== parentIdentity.ino || !sameFilesystemPath(identity.parent, parentIdentity.path)) {
    throw new Error(`Output parent identity changed: ${relativeLabel}`);
  }
  await validateProjectPathIdentity(root, identity, relativeLabel);
  await validateProjectPathIdentity(root, parentIdentity, relativeLabel);
  return { contents: captured.contents, mode: Number(identity.mode & 0o777n), identity };
}
async function ensureParentDirectories(root, parent, created, relativeLabel, beforeOwnedParentMutation, afterOwnedParentMutation) {
  const missing = [];
  let current = parent;
  while (isInside(root, current) && current !== root) {
    const metadata = await optionalLstat2(current);
    if (metadata) {
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error(`Output parent is not an ordinary directory: ${current}`);
      break;
    }
    missing.push(current);
    current = dirname5(current);
  }
  for (const directory of missing.reverse()) {
    const createdParent = created.find((entry) => sameFilesystemPath(entry.path, dirname5(directory)));
    const parentBeforeCreation = createdParent?.identity ?? await captureProjectPathIdentity(
      root,
      dirname5(directory),
      "directory",
      relativeLabel
    );
    try {
      await validateProjectPathIdentity(root, parentBeforeCreation, relativeLabel);
      await beforeOwnedParentMutation?.(parentBeforeCreation);
      await mkdir2(directory);
      const identity = await captureProjectPathIdentity(root, directory, "directory", relativeLabel);
      created.push({
        path: directory,
        identity
      });
      const parentAfterCreation = await captureProjectPathIdentity(
        root,
        parentBeforeCreation.path,
        "directory",
        relativeLabel
      );
      const expectedLinkDelta = parentLinkDeltaForOwnedChildDirectory(identity, 1n, relativeLabel);
      if (!sameDirectoryAcrossOwnedMutation(parentBeforeCreation, parentAfterCreation, expectedLinkDelta)) {
        throw new Error(`Output parent stable identity changed during owned directory creation: ${relativeLabel}`);
      }
      if (createdParent) createdParent.identity = parentAfterCreation;
      await afterOwnedParentMutation?.(parentBeforeCreation, parentAfterCreation);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const metadata = await lstat9(directory);
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error(`Output parent is not an ordinary directory: ${directory}`);
    }
  }
}
async function captureRenamedFile(root, path, parentIdentity, sourceIdentity, relativeLabel) {
  const identity = await captureProjectPathIdentity(root, path, "file", relativeLabel);
  if (!sameProjectVersionAcrossRename(sourceIdentity, identity) || identity.parentDev !== parentIdentity.dev || identity.parentIno !== parentIdentity.ino || !sameFilesystemPath(identity.parent, parentIdentity.path)) {
    throw new Error(`Output file identity changed across rename: ${relativeLabel}`);
  }
  return identity;
}
async function assertTargetState(changeset, item, expected) {
  await validateProjectPathIdentity(changeset.root, item.parentIdentity, item.change.path);
  const current = await optionalCapturedRegularFileState(
    changeset.root,
    item.target,
    item.parentIdentity,
    item.change.path
  );
  if (expected === "missing") {
    if (current) throw new Error(`Target identity changed from missing before rename: ${item.change.path}`);
    return void 0;
  }
  if (!current || !item.targetIdentity || !sameProjectIdentity(current.identity, item.targetIdentity) || pathHash(current.contents) !== item.change.previousHash) {
    throw new Error(`Target identity or content is stale before rename: ${item.change.path}`);
  }
  return current;
}
async function removeProjectArtifact(changeset, parentIdentity, identity, relativePath, artifactName, label) {
  try {
    await validateProjectPathIdentity(changeset.root, parentIdentity, relativePath);
    await validateProjectPathIdentity(changeset.root, identity, relativePath);
    await unlink2(identity.path);
  } catch (error) {
    throw new Error(`${label === "quarantine" ? "Quarantine" : "Temporary"} cleanup is ambiguous for ${artifactName}`, { cause: error });
  }
}
function primaryMessage(error) {
  return error instanceof Error ? error.message : "unknown apply failure";
}
async function atomicApply(changeset, verifyBeforeCommit, beforeCommit, beforeRename, beforeStageWrite, beforeMutationRename, afterMutationRename, beforePostRenameIdentityCapture, beforeQuarantineCleanup, assertMutationAuthority = async () => void 0) {
  const staged = [];
  let commitOrder = [];
  const createdDirectories = [];
  let primaryError;
  const rollbackErrors = [];
  const assertTrackedParentBeforeOwnedMutation = async (current) => {
    for (const item of staged) {
      if (!sameFilesystemPath(item.parentIdentity.path, current.path)) continue;
      if (!sameProjectIdentity(item.parentIdentity, current)) {
        throw new Error(`Output parent identity changed before owned directory creation: ${item.change.path}`);
      }
    }
  };
  const refreshTrackedParentAfterOwnedMutation = async (previous, current) => {
    for (const item of staged) {
      if (sameFilesystemPath(item.parentIdentity.path, previous.path) && sameProjectIdentity(item.parentIdentity, previous)) {
        item.parentIdentity = current;
      }
    }
  };
  const refreshParentAfterOwnedMutation = async (previous, relativeLabel) => {
    const current = await captureProjectPathIdentity(changeset.root, previous.path, "directory", relativeLabel);
    if (!sameDirectoryAcrossOwnedMutation(previous, current)) {
      throw new Error(`Output parent stable identity changed during owned mutation: ${relativeLabel}`);
    }
    for (const item of staged) {
      if (sameFilesystemPath(item.parentIdentity.path, previous.path) && item.parentIdentity.dev === previous.dev && item.parentIdentity.ino === previous.ino) {
        item.parentIdentity = current;
      }
    }
    for (const directory of createdDirectories) {
      if (sameFilesystemPath(directory.path, previous.path) && directory.identity.dev === previous.dev && directory.identity.ino === previous.ino) {
        directory.identity = current;
      }
    }
    return current;
  };
  try {
    for (const [index2, change] of changeset.changes.entries()) {
      const target = join7(changeset.root, ...change.path.split("/"));
      await ensureParentDirectories(
        changeset.root,
        dirname5(target),
        createdDirectories,
        change.path,
        assertTrackedParentBeforeOwnedMutation,
        refreshTrackedParentAfterOwnedMutation
      );
      const parentIdentity = await captureProjectPathIdentity(changeset.root, dirname5(target), "directory", change.path);
      const original = await optionalCapturedRegularFileState(changeset.root, target, parentIdentity, change.path);
      if (pathHash(original?.contents) !== change.previousHash) throw new Error(`Target is stale before staging: ${change.path}`);
      if (change.delete) staged.push({
        index: index2,
        change,
        target,
        parentIdentity,
        targetIdentity: original?.identity,
        quarantineRenamed: false,
        replacementRenamed: false,
        rollbackDiscardRenamed: false,
        committed: false
      });
      else {
        const temporary = join7(dirname5(target), `.${basename4(target)}.project-design-keeper-${randomUUID3()}.stage`);
        staged.push({
          index: index2,
          change,
          target,
          parentIdentity,
          targetIdentity: original?.identity,
          temporary,
          quarantineRenamed: false,
          replacementRenamed: false,
          rollbackDiscardRenamed: false,
          committed: false
        });
      }
    }
    const manifestPathKey = windowsRepositoryPathKey("docs/project-design/manifest.json");
    commitOrder = [
      ...staged.filter((item) => windowsRepositoryPathKey(item.change.path) !== manifestPathKey),
      ...staged.filter((item) => windowsRepositoryPathKey(item.change.path) === manifestPathKey)
    ];
    await beforeCommit?.(changeset.root);
    for (const item of staged) {
      await beforeRename?.(item.change.path, item.index);
      if (item.temporary) await beforeStageWrite?.(item.change.path, item.index);
    }
    await verifyBeforeCommit();
    for (const item of staged) {
      const canonical2 = await canonicalOutput(changeset.root, item.change.path);
      if (canonical2.target !== item.target) throw new Error(`Output target changed before staging: ${item.change.path}`);
      await assertTargetState(changeset, item, item.targetIdentity ? "original" : "missing");
    }
    for (const item of staged) {
      if (!item.temporary) continue;
      await validateProjectPathIdentity(changeset.root, item.parentIdentity, item.change.path);
      await assertTargetState(changeset, item, item.targetIdentity ? "original" : "missing");
      const parentBeforeCreate = item.parentIdentity;
      const handle = await open9(item.temporary, "wx+", item.targetIdentity ? Number(item.targetIdentity.mode & 0o777n) : 384);
      try {
        await handle.writeFile(item.change.content, { encoding: "utf8" });
        if (item.targetIdentity) {
          await handle.chmod(Number(item.targetIdentity.mode & 0o777n));
        }
        await handle.sync();
        const captured = await captureProjectPathEvidence(
          changeset.root,
          item.temporary,
          "file",
          item.change.path,
          { ownedHandle: handle }
        );
        const approvedHash = pathHash(Buffer.from(item.change.content, "utf8"));
        if (captured.identity.contentHash !== approvedHash) {
          throw new Error(`Exclusive staging content differs from the approved output: ${item.change.path}`);
        }
        item.temporaryIdentity = captured.identity;
      } finally {
        await handle.close();
      }
      await refreshParentAfterOwnedMutation(parentBeforeCreate, item.change.path);
      const capturedTemporary = await captureProjectPathIdentity(changeset.root, item.temporary, "file", item.change.path);
      if (!item.temporaryIdentity || !sameProjectIdentity(item.temporaryIdentity, capturedTemporary)) {
        throw new Error(`Exclusive staging identity changed: ${item.change.path}`);
      }
    }
    for (const item of commitOrder) {
      const firstPhase = item.targetIdentity ? "quarantine" : "replacement";
      await beforeMutationRename?.(item.change.path, item.index, firstPhase);
      await verifyBeforeCommit();
      const canonical2 = await canonicalOutput(changeset.root, item.change.path);
      if (canonical2.target !== item.target) throw new Error(`Output target changed during apply: ${item.change.path}`);
      if (item.targetIdentity) {
        item.quarantine = join7(dirname5(item.target), `.${basename4(item.target)}.project-design-keeper-${randomUUID3()}.quarantine`);
        if (await optionalLstat2(item.quarantine)) throw new Error(`Random quarantine name was already occupied: ${item.change.path}`);
        await assertMutationAuthority();
        await assertTargetState(changeset, item, "original");
        if (await optionalLstat2(item.quarantine)) throw new Error(`Random quarantine name was occupied before rename: ${item.change.path}`);
        const parentBeforeQuarantine = item.parentIdentity;
        await rename3(item.target, item.quarantine);
        item.quarantineRenamed = true;
        await refreshParentAfterOwnedMutation(parentBeforeQuarantine, item.change.path);
        await beforePostRenameIdentityCapture?.(item.change.path, "quarantine", basename4(item.quarantine));
        await validateProjectPathIdentity(changeset.root, item.parentIdentity, item.change.path);
        item.quarantineIdentity = await captureRenamedFile(
          changeset.root,
          item.quarantine,
          item.parentIdentity,
          item.targetIdentity,
          item.change.path
        );
        await afterMutationRename?.(item.change.path, "quarantine", basename4(item.quarantine));
        await assertMutationAuthority();
      } else {
        await assertTargetState(changeset, item, "missing");
      }
      if (item.temporary && item.temporaryIdentity) {
        if (item.targetIdentity) await beforeMutationRename?.(item.change.path, item.index, "replacement");
        await assertMutationAuthority();
        await validateProjectPathIdentity(changeset.root, item.parentIdentity, item.change.path);
        await assertTargetState(changeset, item, "missing");
        await validateProjectPathIdentity(changeset.root, item.temporaryIdentity, item.change.path);
        const parentBeforeReplacement = item.parentIdentity;
        await rename3(item.temporary, item.target);
        item.replacementRenamed = true;
        await refreshParentAfterOwnedMutation(parentBeforeReplacement, item.change.path);
        await beforePostRenameIdentityCapture?.(item.change.path, "replacement");
        await validateProjectPathIdentity(changeset.root, item.parentIdentity, item.change.path);
        item.committedIdentity = await captureRenamedFile(
          changeset.root,
          item.target,
          item.parentIdentity,
          item.temporaryIdentity,
          item.change.path
        );
        await afterMutationRename?.(item.change.path, "replacement");
        await assertMutationAuthority();
      }
      item.committed = true;
    }
  } catch (error) {
    primaryError = error;
    for (const item of [...commitOrder].reverse().filter((candidate) => candidate.committed || candidate.replacementRenamed || candidate.quarantineRenamed || candidate.committedIdentity !== void 0 || candidate.quarantineIdentity !== void 0)) {
      try {
        await assertMutationAuthority();
        await validateProjectPathIdentity(changeset.root, item.parentIdentity, item.change.path);
        if (item.replacementRenamed && !item.committedIdentity) {
          if (!item.temporaryIdentity) throw new Error(`Replacement identity evidence is missing: ${item.change.path}`);
          item.committedIdentity = await captureRenamedFile(
            changeset.root,
            item.target,
            item.parentIdentity,
            item.temporaryIdentity,
            item.change.path
          );
        }
        if (item.quarantineRenamed && !item.quarantineIdentity) {
          if (!item.quarantine || !item.targetIdentity) {
            throw new Error(`Quarantine identity evidence is missing: ${item.change.path}`);
          }
          item.quarantineIdentity = await captureRenamedFile(
            changeset.root,
            item.quarantine,
            item.parentIdentity,
            item.targetIdentity,
            item.change.path
          );
        }
        if (item.committedIdentity) {
          await beforeMutationRename?.(item.change.path, item.index, "rollback-target");
          await assertMutationAuthority();
          await validateProjectPathIdentity(changeset.root, item.parentIdentity, item.change.path);
          await validateProjectPathIdentity(changeset.root, item.committedIdentity, item.change.path);
          item.rollbackDiscard = join7(dirname5(item.target), `.${basename4(item.target)}.project-design-keeper-${randomUUID3()}.rollback`);
          if (await optionalLstat2(item.rollbackDiscard)) throw new Error(`Rollback quarantine name was occupied: ${item.change.path}`);
          const parentBeforeRollbackTarget = item.parentIdentity;
          await rename3(item.target, item.rollbackDiscard);
          item.rollbackDiscardRenamed = true;
          item.replacementRenamed = false;
          await refreshParentAfterOwnedMutation(parentBeforeRollbackTarget, item.change.path);
          await beforePostRenameIdentityCapture?.(
            item.change.path,
            "rollback-target",
            basename4(item.rollbackDiscard)
          );
          await validateProjectPathIdentity(changeset.root, item.parentIdentity, item.change.path);
          item.rollbackDiscardIdentity = await captureRenamedFile(
            changeset.root,
            item.rollbackDiscard,
            item.parentIdentity,
            item.committedIdentity,
            item.change.path
          );
          await afterMutationRename?.(item.change.path, "rollback-target", basename4(item.rollbackDiscard));
        }
        await assertTargetState(changeset, item, "missing");
        if (item.quarantine && item.quarantineIdentity) {
          await beforeMutationRename?.(item.change.path, item.index, "rollback-restore");
          await assertMutationAuthority();
          await validateProjectPathIdentity(changeset.root, item.parentIdentity, item.change.path);
          await assertTargetState(changeset, item, "missing");
          await validateProjectPathIdentity(changeset.root, item.quarantineIdentity, item.change.path);
          const parentBeforeRollbackRestore = item.parentIdentity;
          await rename3(item.quarantine, item.target);
          item.quarantineRenamed = false;
          await refreshParentAfterOwnedMutation(parentBeforeRollbackRestore, item.change.path);
          await beforePostRenameIdentityCapture?.(item.change.path, "rollback-restore");
          await validateProjectPathIdentity(changeset.root, item.parentIdentity, item.change.path);
          await captureRenamedFile(
            changeset.root,
            item.target,
            item.parentIdentity,
            item.quarantineIdentity,
            item.change.path
          );
          item.quarantineIdentity = void 0;
          await afterMutationRename?.(item.change.path, "rollback-restore");
        }
        if (item.rollbackDiscardRenamed && item.rollbackDiscard && item.rollbackDiscardIdentity) {
          const parentBeforeRollbackCleanup = item.parentIdentity;
          await removeProjectArtifact(
            changeset,
            item.parentIdentity,
            item.rollbackDiscardIdentity,
            item.change.path,
            basename4(item.rollbackDiscard),
            "quarantine"
          );
          await refreshParentAfterOwnedMutation(parentBeforeRollbackCleanup, item.change.path);
          item.rollbackDiscardRenamed = false;
          item.rollbackDiscardIdentity = void 0;
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
  }
  const stagingCleanupErrors = [];
  for (const item of staged) {
    if (!item.temporary || !item.temporaryIdentity) continue;
    try {
      const metadata = await optionalLstat2(item.temporary);
      if (metadata) {
        const parentBeforeTemporaryCleanup = item.parentIdentity;
        await removeProjectArtifact(
          changeset,
          item.parentIdentity,
          item.temporaryIdentity,
          item.change.path,
          basename4(item.temporary),
          "temporary"
        );
        await refreshParentAfterOwnedMutation(parentBeforeTemporaryCleanup, item.change.path);
      }
    } catch (error) {
      stagingCleanupErrors.push(error);
    }
  }
  for (const directory of [...createdDirectories].sort((left, right) => right.path.length - left.path.length)) {
    try {
      const createdParent = createdDirectories.find((entry) => sameFilesystemPath(entry.path, dirname5(directory.path)));
      const parentBeforeRemoval = createdParent?.identity;
      await validateProjectPathIdentity(changeset.root, directory.identity, relative5(changeset.root, directory.path));
      if (parentBeforeRemoval) {
        await validateProjectPathIdentity(
          changeset.root,
          parentBeforeRemoval,
          relative5(changeset.root, parentBeforeRemoval.path)
        );
      }
      await rmdir2(directory.path);
      if (createdParent && parentBeforeRemoval) {
        const parentAfterRemoval = await captureProjectPathIdentity(
          changeset.root,
          parentBeforeRemoval.path,
          "directory",
          relative5(changeset.root, parentBeforeRemoval.path)
        );
        const expectedLinkDelta = parentLinkDeltaForOwnedChildDirectory(
          directory.identity,
          -1n,
          relative5(changeset.root, directory.path)
        );
        if (!sameDirectoryAcrossOwnedMutation(parentBeforeRemoval, parentAfterRemoval, expectedLinkDelta)) {
          throw new Error(`Output parent stable identity changed during owned directory cleanup: ${relative5(changeset.root, parentBeforeRemoval.path)}`);
        }
        createdParent.identity = parentAfterRemoval;
      }
    } catch (error) {
      if (!(/* @__PURE__ */ new Set(["ENOENT", "ENOTEMPTY", "EEXIST"])).has(error.code ?? "")) {
        stagingCleanupErrors.push(error);
      }
    }
  }
  if (primaryError !== void 0) {
    const incomplete = [...rollbackErrors, ...stagingCleanupErrors];
    if (incomplete.length > 0) {
      const retainedQuarantines = staged.flatMap((item) => [
        ...item.quarantineRenamed && item.quarantine ? [basename4(item.quarantine)] : [],
        ...item.rollbackDiscardRenamed && item.rollbackDiscard ? [basename4(item.rollbackDiscard)] : []
      ]);
      const retainedEvidence = retainedQuarantines.length > 0 ? `; retained quarantine evidence: ${retainedQuarantines.join(", ")}` : "";
      throw new AggregateError(
        [primaryError, ...incomplete],
        `Apply failed: ${primaryMessage(primaryError)}; rollback or cleanup was incomplete${retainedEvidence}`,
        { cause: primaryError }
      );
    }
    throw primaryError;
  }
  const quarantineCleanupErrors = [];
  for (const item of staged) {
    if (!item.quarantine || !item.quarantineIdentity) continue;
    try {
      await beforeQuarantineCleanup?.(item.change.path, basename4(item.quarantine));
      await assertMutationAuthority();
      const parentBeforeQuarantineCleanup = item.parentIdentity;
      await removeProjectArtifact(
        changeset,
        item.parentIdentity,
        item.quarantineIdentity,
        item.change.path,
        basename4(item.quarantine),
        "quarantine"
      );
      await refreshParentAfterOwnedMutation(parentBeforeQuarantineCleanup, item.change.path);
      item.quarantineIdentity = void 0;
      item.quarantineRenamed = false;
    } catch (error) {
      quarantineCleanupErrors.push(error);
    }
  }
  if (quarantineCleanupErrors.length > 0 || stagingCleanupErrors.length > 0) {
    const errors = [...quarantineCleanupErrors, ...stagingCleanupErrors];
    throw new AggregateError(
      errors,
      `Project update committed, but quarantine cleanup was ambiguous: ${errors.map(primaryMessage).join("; ")}`
    );
  }
}
function createTransactionService(options = {}) {
  const cacheDirectory = resolveCacheDirectory(
    options,
    options.environment ?? process.env,
    options.homeDirectory ?? homedir2()
  );
  const now = options.now ?? (() => Date.now());
  const limits = resolveKeeperLimits(options.limits);
  const approvalAuthority = createApplyApprovalAuthority(now);
  const changesetStore = createChangesetStore({
    cacheDirectory,
    environment: options.environment,
    homeDirectory: options.homeDirectory,
    now,
    limits: options.limits
  });
  async function loadAuthenticatedChangeset(request) {
    await validateManagedRoots(request.root);
    return changesetStore.loadAuthenticated(request.root, request.changesetId);
  }
  async function inspectChangesetForApproval(input) {
    const request = await resolveChangesetRequest(input);
    const { changeset } = await loadAuthenticatedChangeset(request);
    const binding = approvalBinding(changeset);
    assertSerializedWithin("Changeset approval summary", binding, 1024 * 1024);
    return binding;
  }
  function issueApplyAuthorization(binding, requestIdentity) {
    return approvalAuthority.issue(binding, requestIdentity);
  }
  async function previewUpdate(input) {
    if (typeof input.root !== "string") throw new Error("A repository root is required");
    const changes = requestedChanges(input.changes);
    let candidatePack = typeof input.pack === "object" && input.pack !== null && !Array.isArray(input.pack) ? input.pack : void 0;
    const previewReads = projectFileReadBudget(
      "Preview file reads",
      limits.preview.maxFileBytes,
      limits.preview.maxAggregateBytes,
      limits.scan.maxFiles,
      limits.scan.deadlineMs
    );
    const candidateValidationResources = {
      maxFileBytes: previewReads.maxFileBytes,
      files: previewReads.files,
      bytes: previewReads.aggregate,
      deadline: previewReads.deadline,
      accountedFiles: previewReads.accountedFiles
    };
    if (candidatePack) {
      assertPackValidationInputBounds(candidatePack, {
        limits: options.limits,
        resourceBudget: candidateValidationResources
      });
      const serializedCandidatePack = JSON.stringify(candidatePack);
      if (serializedCandidatePack === void 0) throw new Error("Candidate pack must be serializable JSON");
      candidatePack = JSON.parse(serializedCandidatePack);
    }
    const decisions = redundancyDecisions(input.redundancyDecisions);
    const analysisId = typeof input.analysisId === "string" ? input.analysisId : void 0;
    if (decisions && !analysisId || analysisId && !decisions) {
      throw new Error("analysisId and redundancyDecisions must be supplied together");
    }
    if (decisions && !candidatePack) throw new Error("A candidate pack is required for redundancy decisions");
    const lexicalOutputs = changes.map((change) => canonicalRelativePath(change.path));
    if (lexicalOutputs.some((output) => output.managedRoot === "docs/project-design") && !candidatePack) {
      throw new Error("A candidate pack is required when previewing project-design documents");
    }
    const scope = await resolveScope({ root: input.root, path: "." });
    await validateManagedRoots(scope.root);
    const manifestPath = "docs/project-design/manifest.json";
    const manifestKey = windowsRepositoryPathKey(manifestPath);
    const currentManifestTarget = (await canonicalOutput(scope.root, manifestPath)).target;
    const currentManifestBytesAtPreview = await boundedOptionalProjectRead(
      scope.root,
      currentManifestTarget,
      manifestPath,
      previewReads
    );
    const currentPackAtPreview = currentManifestBytesAtPreview ? parseCandidateManifest(currentManifestBytesAtPreview) : void 0;
    if (options.afterCurrentManifestRead) await options.afterCurrentManifestRead(scope.root);
    const allowSchemaMigrationRegrouping = candidatePack?.schemaVersion === "3.0" && (currentPackAtPreview?.schemaVersion === "1.0" || currentPackAtPreview?.schemaVersion === "2.0");
    await changesetStore.collectGarbage(scope.root);
    const resolvedChanges = await Promise.all(changes.map(async (change) => ({ change, ...await canonicalOutput(scope.root, change.path) })));
    const grouped = /* @__PURE__ */ new Map();
    for (const resolvedChange of resolvedChanges) {
      const existing = grouped.get(resolvedChange.key);
      if (existing) existing.changes.push(resolvedChange.change);
      else grouped.set(resolvedChange.key, { path: resolvedChange.path, target: resolvedChange.target, changes: [resolvedChange.change] });
    }
    for (const group of grouped.values()) {
      if (group.changes.length > 1 && group.changes.some((change) => !change.managedBlock)) {
        throw new Error(`Duplicate aliased output path must contain only managed-block updates: ${group.path}`);
      }
    }
    const changesProjectDesign = resolvedChanges.some(({ path }) => path.startsWith("docs/project-design/"));
    const unmanaged = changesProjectDesign ? await unmanagedOutputs(scope.root, limits, previewReads, options.beforeProjectDesignOutputEntry) : [];
    if (unmanaged.length > 0 && changesProjectDesign) {
      const unmanagedConflicts = [`Unmanaged project-design output exists: ${unmanaged.join(", ")}`];
      return {
        applicable: false,
        conflicts: unmanagedConflicts,
        ...candidatePack ? { validation: conflictValidation(unmanagedConflicts) } : {},
        changes: []
      };
    }
    const conflicts = [];
    const persisted = [];
    const originals = /* @__PURE__ */ new Map();
    for (const { path, target, changes: targetChanges } of grouped.values()) {
      const original = await boundedOptionalProjectRead(scope.root, target, path, previewReads);
      originals.set(path, original);
      const existingOwnership = original ? ownership(path, original) : void 0;
      if (original && !existingOwnership.owned) {
        conflicts.push(`${path}: Existing output is unmanaged: ${existingOwnership.conflict ?? "missing Keeper ownership"}`);
        continue;
      }
      const [firstChange] = targetChanges;
      if (firstChange.delete) {
        if (!original || !existingOwnership.fullyOwned) {
          conflicts.push(`${path}: delete requires fully Keeper-owned content`);
          continue;
        }
        persisted.push({ path, delete: true, previousHash: pathHash(original) });
        continue;
      }
      if (firstChange.content !== void 0) {
        const candidateBytes = Buffer.from(firstChange.content, "utf8");
        const migratingToDerivedNavigation = candidatePack?.schemaVersion === "2.0" || candidatePack?.schemaVersion === "3.0";
        const machineOutput = /\.jsonl?$/iu.test(path);
        if (original && !machineOutput && !derivedReplacementAllowed(
          original,
          candidateBytes,
          migratingToDerivedNavigation,
          allowSchemaMigrationRegrouping
        )) {
          conflicts.push(`${path}: existing Markdown must be updated through managed blocks`);
          continue;
        }
        const isCandidateManifest = candidatePack !== void 0 && windowsRepositoryPathKey(path) === windowsRepositoryPathKey("docs/project-design/manifest.json") && parseCandidateManifest(candidateBytes) !== void 0;
        if (original && machineOutput && !ownership(path, candidateBytes).owned && !isCandidateManifest) {
          conflicts.push(`${path}: replacement machine output lacks Keeper ownership/schema`);
          continue;
        }
        if (!original) {
          const candidate = creationOwnership(path, candidateBytes);
          if (!candidate.allowed && !isCandidateManifest) {
            conflicts.push(`${path}: new output lacks Keeper ownership: ${candidate.conflict ?? "missing ownership"}`);
            continue;
          }
        }
        persisted.push({ path, content: firstChange.content, previousHash: pathHash(original) });
        continue;
      }
      if (/\.jsonl?$/iu.test(path)) {
        conflicts.push(`${path}: machine outputs cannot be updated through managed blocks`);
        continue;
      }
      if (!original && windowsRepositoryPathKey(path) === keeperSkillPathKey) {
        conflicts.push(`${path}: Keeper SKILL.md must be created with a valid Skill envelope through content`);
        continue;
      }
      let content = original?.toString("utf8") ?? "";
      const managedBlocks2 = [];
      for (const change of targetChanges) {
        const expectedContentHash2 = change.expectedContentHash ?? (typeof input.expectedContentHash === "string" ? input.expectedContentHash : void 0);
        const merged = mergeManagedBlock(
          content,
          change.managedBlock,
          expectedContentHash2
        );
        if (merged.conflict) {
          conflicts.push(`${path}: ${merged.conflict}`);
          break;
        }
        content = merged.content;
        managedBlocks2.push({ ...change.managedBlock, ...expectedContentHash2 ? { expectedContentHash: expectedContentHash2 } : {} });
      }
      if (conflicts.some((conflict) => conflict.startsWith(`${path}:`))) continue;
      persisted.push({
        path,
        content,
        previousHash: pathHash(original),
        managedBlocks: managedBlocks2
      });
    }
    if (conflicts.length > 0) {
      return {
        applicable: false,
        conflicts,
        ...candidatePack ? { validation: conflictValidation(conflicts) } : {},
        changes: persisted.map(({ previousHash: _previousHash, managedBlocks: _managedBlocks, ...change }) => change)
      };
    }
    const capturedManifest = [...originals.entries()].find(([path]) => windowsRepositoryPathKey(path) === manifestKey);
    const exactCurrentManifestBytes = capturedManifest ? capturedManifest[1] : await boundedOptionalProjectRead(scope.root, currentManifestTarget, manifestPath, previewReads);
    if (!equalOptionalBytes(currentManifestBytesAtPreview, exactCurrentManifestBytes)) {
      throw new Error("Project design manifest changed during preview; retry the preview against a stable baseline");
    }
    if (options.afterManifestBaselineValidation) await options.afterManifestBaselineValidation(scope.root);
    const currentPackForChangeset = exactCurrentManifestBytes ? parseCandidateManifest(exactCurrentManifestBytes) : void 0;
    let confirmedArchiveActions = emptyArchiveActions();
    let confirmedHistoryFiles = {};
    let confirmedValidationDependencyDigest;
    let validation;
    if (candidatePack) {
      const overlay = new Map(persisted.map((change) => [
        change.path,
        change.delete ? void 0 : Buffer.from(change.content, "utf8")
      ]));
      const persistedOverlayByKey = new Map(
        [...overlay.entries()].map(([path, value]) => [windowsRepositoryPathKey(path), value])
      );
      const actionFileErrors = actionBearingHistoryPaths(currentPackForChangeset, candidatePack).flatMap((path) => persistedOverlayByKey.get(windowsRepositoryPathKey(path)) !== void 0 ? [] : [{
        code: "archive_action_file_not_persisted",
        path,
        message: "New archive and tombstone actions must be supplied as exact persisted changes"
      }]);
      const originalsByKey = new Map(
        [...originals.entries()].map(([path, value]) => [windowsRepositoryPathKey(path), value])
      );
      const historyDependencySnapshot = /* @__PURE__ */ new Map();
      const readHistoryDependency = async (path) => {
        const key = windowsRepositoryPathKey(path);
        const existing = historyDependencySnapshot.get(key);
        if (existing) return existing.bytes;
        const output = await canonicalOutput(scope.root, path);
        const bytes = await boundedOptionalProjectRead(scope.root, output.target, output.path, previewReads);
        historyDependencySnapshot.set(output.key, { path: output.path, bytes });
        return bytes;
      };
      for (const path of packHistoryPaths(candidatePack)) {
        const key = windowsRepositoryPathKey(path);
        if (persistedOverlayByKey.has(key)) continue;
        const bytes = await readHistoryDependency(path);
        overlay.set(path, bytes);
      }
      const overlayByKey = new Map(
        [...overlay.entries()].map(([path, value]) => [windowsRepositoryPathKey(path), value])
      );
      validation = await validatePack({ root: scope.root, pack: candidatePack }, {
        overlay,
        preaccountedOverlay: new Set(historyDependencySnapshot.keys()),
        limits: options.limits,
        io: options.validationIo,
        resourceBudget: candidateValidationResources,
        onValidationDependencyDigest: (digest) => {
          confirmedValidationDependencyDigest = digest;
        }
      });
      const validationErrors = [
        ...Array.isArray(validation.errors) ? [...validation.errors] : [],
        ...actionFileErrors
      ];
      if (currentPackForChangeset) {
        validationErrors.push(...await migrationPreservationDiagnostics(
          scope.root,
          currentPackForChangeset,
          candidatePack,
          overlay,
          async (path) => {
            const output = await canonicalOutput(scope.root, path);
            return boundedOptionalProjectRead(scope.root, output.target, output.path, previewReads);
          }
        ));
      }
      const overlayManifest = [...overlay.entries()].find(([path]) => windowsRepositoryPathKey(path) === manifestKey);
      const manifestBytes = overlayManifest ? overlayManifest[1] : exactCurrentManifestBytes;
      const manifest2 = manifestBytes ? parseCandidateManifest(manifestBytes) : void 0;
      if (!manifest2) {
        validationErrors.push({ code: "manifest_missing_or_invalid", path: manifestPath, message: "Candidate manifest is missing or lacks Keeper ownership/schema" });
      } else if (!isDeepStrictEqual(manifest2, candidatePack)) {
        validationErrors.push({ code: "manifest_pack_mismatch", path: manifestPath, message: "Candidate manifest does not equal the validated pack" });
      }
      const currentManifest = currentPackForChangeset;
      if (manifest2) {
        const safeHistoryRead = async (path, candidate) => {
          if (!safeRepositoryPath(path, true) || !path.startsWith("docs/project-design/")) return void 0;
          const key = windowsRepositoryPathKey(path);
          if (candidate) return overlayByKey.get(key);
          if (!candidate && originalsByKey.has(key)) return originalsByKey.get(key);
          return readHistoryDependency(path);
        };
        if (manifest2.schemaVersion === "3.0") {
          try {
            await loadAndValidateHistoryOverlay(manifest2, (path) => safeHistoryRead(path, true));
          } catch (error) {
            validationErrors.push({
              code: "history_integrity_invalid",
              path: "archive",
              message: `Candidate Schema 3.0 history is invalid: ${error instanceof Error ? error.message : "unknown history error"}`
            });
          }
        }
        const transitionIssues = currentManifest ? await validateArchiveTransition({
          currentPack: currentManifest,
          candidatePack: manifest2,
          readCurrent: (path) => safeHistoryRead(path, false),
          readCandidate: (path) => safeHistoryRead(path, true),
          now
        }) : [];
        validationErrors.push(...transitionIssues.map((issue) => ({ ...issue })));
        if (transitionIssues.length === 0 && validationErrors.length === 0) {
          confirmedArchiveActions = await deriveArchiveActions(
            currentManifest,
            manifest2,
            (path) => safeHistoryRead(path, false),
            (path) => safeHistoryRead(path, true)
          );
        }
      }
      if (validationErrors.length === 0 && decisions && analysisId) {
        const candidateRecordAssessments = Array.isArray(validation.recordAssessments) ? validation.recordAssessments.filter((assessment) => Boolean(assessment) && typeof assessment === "object" && !Array.isArray(assessment) && typeof assessment.id === "string" && ["high", "medium", "low"].includes(String(assessment.effectiveConfidence))) : [];
        await validateRedundancyDecisions({
          root: scope.root,
          analysisId,
          decisions,
          candidatePack,
          candidateRecordAssessments,
          now
        });
      }
      validation = { ...validation, valid: validationErrors.length === 0, errors: validationErrors };
      if (validationErrors.length > 0) {
        return {
          applicable: false,
          conflicts: ["Candidate pack validation failed"],
          validation,
          changes: persisted.map(({ previousHash: _previousHash, managedBlocks: _managedBlocks, ...change }) => change)
        };
      }
      if (!confirmedValidationDependencyDigest) {
        throw new Error("Candidate pack validation did not capture its dependency digest");
      }
      confirmedHistoryFiles = Object.fromEntries([...historyDependencySnapshot.values()].sort((left, right) => left.path.localeCompare(right.path, "en-US")).map(({ path, bytes }) => [path, pathHash(bytes)]));
    }
    if (candidatePack && options.afterCandidateValidation) await options.afterCandidateValidation(scope.root);
    const createdAt = now();
    const changesetId = randomUUID3();
    const sourceScope = { root: scope.root, ...typeof input.path === "string" ? { path: input.path } : {} };
    const candidateSourceRevision = candidatePack?.sourceRevision && typeof candidatePack.sourceRevision === "object" && !Array.isArray(candidatePack.sourceRevision) ? candidatePack.sourceRevision.files : void 0;
    const sourcePaths = candidateSourceRevision && typeof candidateSourceRevision === "object" && !Array.isArray(candidateSourceRevision) ? Object.keys(candidateSourceRevision).sort() : void 0;
    const confirmedSemanticDecisionIds = semanticDecisionIds(currentPackForChangeset, candidatePack, decisions);
    const changeset = {
      version: 2,
      changesetId,
      root: scope.root,
      createdAt,
      expiresAt: createdAt + changesetLifetimeMs,
      diffDigest: persistedDiffDigest(persisted, confirmedSemanticDecisionIds),
      archiveActions: confirmedArchiveActions,
      semanticDecisionIds: confirmedSemanticDecisionIds,
      historyFiles: confirmedHistoryFiles,
      changes: persisted,
      manifestHash: pathHash(exactCurrentManifestBytes),
      sourceScope,
      ...sourcePaths && sourcePaths.length > 0 ? { sourcePaths } : {},
      sourceFiles: sourcePaths && sourcePaths.length > 0 ? Object.fromEntries(sourcePaths.map((path) => [path, String(candidateSourceRevision[path])])) : await sourceFingerprint(sourceScope, options),
      ...candidatePack && confirmedValidationDependencyDigest ? { validatedPack: candidatePack, validationDependencyDigest: confirmedValidationDependencyDigest } : {}
    };
    const diff = unifiedDiff(persisted, originals);
    const diffBytes = Buffer.byteLength(diff, "utf8");
    if (diffBytes > limits.preview.maxDiffBytes) {
      const kibibytes = limits.preview.maxDiffBytes / 1024;
      throw new Error(`Generated diff exceeds the limit of ${kibibytes} KiB (${limits.preview.maxDiffBytes} bytes)`);
    }
    const previewResult = {
      applicable: true,
      conflicts: [],
      ...validation ? { validation } : {},
      changesetId,
      createdAt: new Date(createdAt).toISOString(),
      expiresAt: new Date(changeset.expiresAt).toISOString(),
      diffDigest: changeset.diffDigest,
      summary: summaryFor(persisted),
      diff,
      changes: persisted.map(({ previousHash: _previousHash, managedBlocks: _managedBlocks, ...change }) => change)
    };
    assertToolResultBudget(previewResult);
    const prepared = await changesetStore.preparePublication(changeset);
    await changesetStore.publishPair(prepared);
    return previewResult;
  }
  async function applyUpdate(input, authorization, requestIdentity) {
    const request = await resolveChangesetRequest(input);
    const layout = await prepareSecureCache({
      cacheDirectory,
      environment: options.environment,
      homeDirectory: options.homeDirectory
    }, request.root);
    return withProcessLease({
      layout,
      projectRoot: request.root,
      now,
      timeoutMs: options.processLeaseTimeoutMs,
      leaseMs: options.processLeaseMs
    }, async (lease) => {
      const loaded = await loadAuthenticatedChangeset(request);
      if (!authorization || !requestIdentity) throw new Error("Apply requires host-mediated authorization");
      const binding = approvalBinding(loaded.changeset);
      approvalAuthority.consume(authorization, binding, requestIdentity);
      const changeset = {
        ...loaded.changeset,
        changes: loaded.changeset.changes.map((change) => ({
          ...change,
          ...change.managedBlocks ? { managedBlocks: change.managedBlocks.map((block) => ({ ...block })) } : {}
        }))
      };
      const targetReads = projectFileReadBudget(
        "Apply target file reads",
        limits.preview.maxFileBytes,
        limits.preview.maxAggregateBytes,
        limits.scan.maxFiles,
        limits.scan.deadlineMs
      );
      for (const change of changeset.changes) {
        const { target } = await canonicalOutput(changeset.root, change.path);
        const current = await regularFileState(changeset.root, target, change.path, targetReads);
        if (pathHash(current?.contents) !== change.previousHash) throw new Error(`Target is stale: ${change.path}`);
        if (change.managedBlocks) {
          let content = current?.contents.toString("utf8") ?? "";
          for (const block of change.managedBlocks) {
            const merged = mergeManagedBlock(content, block, block.expectedContentHash);
            if (merged.conflict) throw new Error(`Managed operation is no longer applicable for ${change.path}: ${merged.conflict}`);
            content = merged.content;
          }
          change.content = content;
        }
        if (current) {
          const currentOwnership = ownership(change.path, current.contents);
          if (!currentOwnership.owned) throw new Error(`Target lacks Keeper ownership/schema: ${change.path}`);
          if (change.delete && !currentOwnership.fullyOwned) throw new Error(`Delete target is not fully Keeper-owned: ${change.path}`);
          if (change.content !== void 0 && !ownership(change.path, Buffer.from(change.content, "utf8")).owned) {
            throw new Error(`Replacement output lacks Keeper ownership/schema: ${change.path}`);
          }
        } else if (change.content !== void 0) {
          const candidate = creationOwnership(change.path, Buffer.from(change.content, "utf8"));
          if (!candidate.allowed) throw new Error(`New output lacks Keeper ownership/schema: ${change.path}`);
        }
      }
      const dependencyReads = projectFileReadBudget(
        "Apply dependency file reads",
        limits.preview.maxFileBytes,
        limits.preview.maxAggregateBytes,
        limits.scan.maxFiles,
        limits.scan.deadlineMs
      );
      const exactSourceReads = changeset.sourcePaths ? createExactSourceReadBudget(limits) : void 0;
      const scopedSourceReads = changeset.sourcePaths ? void 0 : createScopeOperationBudget(options);
      const validationOverlay = changeset.validatedPack ? /* @__PURE__ */ new Map() : void 0;
      if (validationOverlay) {
        for (const change of changeset.changes) {
          const contents = change.delete ? void 0 : Buffer.from(change.content, "utf8");
          if (contents && contents.byteLength > dependencyReads.maxFileBytes) {
            throw new Error(`Apply validation overlay exceeds the per-file limit of ${dependencyReads.maxFileBytes} bytes: ${change.path}`);
          }
          if (contents) dependencyReads.aggregate.consume(contents.byteLength);
          validationOverlay.set(change.path, contents);
        }
      }
      const validationOverlayKeys = validationOverlay ? new Set([...validationOverlay.keys()].map(windowsRepositoryPathKey)) : void 0;
      const validationAnalysisBytes = new ByteBudget(
        "Apply candidate validation analysis",
        limits.scan.maxAggregateBytes
      );
      const validationWork = new CounterBudget("Apply candidate validation work", limits.scan.maxEvidence);
      const validationManagedEntries = new CounterBudget(
        "Apply candidate validation managed-tree entries",
        Math.min(limits.scan.maxFiles, 4096)
      );
      const validationResources = {
        maxFileBytes: dependencyReads.maxFileBytes,
        files: dependencyReads.files,
        bytes: dependencyReads.aggregate,
        deadline: dependencyReads.deadline,
        analysisBytes: validationAnalysisBytes,
        work: validationWork,
        managedEntries: validationManagedEntries,
        accountedFiles: dependencyReads.accountedFiles
      };
      const verifyManifestAndSource = async () => {
        await lease.assertOwned();
        if (await manifestFingerprint(changeset.root, dependencyReads) !== changeset.manifestHash) {
          throw new Error("Project design manifest is stale");
        }
        for (const [path, expectedHash] of Object.entries(changeset.historyFiles).sort(([left], [right]) => left.localeCompare(right, "en-US"))) {
          const { target } = await canonicalOutput(changeset.root, path);
          const current = await regularFileState(changeset.root, target, path, dependencyReads);
          if (pathHash(current?.contents) !== expectedHash) {
            throw new Error(`Project design history dependency is stale: ${path}`);
          }
        }
        const currentSources = changeset.sourcePaths ? await exactSourceFingerprint(changeset.root, changeset.sourcePaths, exactSourceReads) : await sourceFingerprint(changeset.sourceScope, options, scopedSourceReads);
        if (!equalFingerprints(currentSources, changeset.sourceFiles)) throw new Error("Selected source snapshot is stale");
        if (changeset.validatedPack && changeset.validationDependencyDigest) {
          let currentDependencyDigest;
          const currentValidation = await validatePack({ root: changeset.root, pack: changeset.validatedPack }, {
            overlay: validationOverlay,
            preaccountedOverlay: validationOverlayKeys,
            limits: options.limits,
            io: options.validationIo,
            resourceBudget: validationResources,
            onValidationDependencyDigest: (digest) => {
              currentDependencyDigest = digest;
            }
          });
          if (currentValidation.valid !== true || currentDependencyDigest !== changeset.validationDependencyDigest) {
            throw new Error("Candidate pack validation dependency is stale");
          }
        }
      };
      await verifyManifestAndSource();
      await storeRecoverySnapshot(loaded.cache, changeset, now(), {
        beforeRecoveryTargetOpen: options.beforeRecoveryTargetOpen,
        afterRecoveryTargetOpen: options.afterRecoveryTargetOpen,
        afterRecoveryTargetRead: options.afterRecoveryTargetRead,
        beforeRecoverySnapshotPublish: options.beforeRecoverySnapshotPublish
      });
      await atomicApply(
        changeset,
        verifyManifestAndSource,
        options.beforeCommit,
        options.beforeRename,
        options.beforeStageWrite,
        options.beforeMutationRename,
        options.afterMutationRename,
        options.beforePostRenameIdentityCapture,
        options.beforeQuarantineCleanup,
        lease.assertOwned
      );
      try {
        await options.beforeChangesetConsume?.(changeset.root, changeset.changesetId);
        await changesetStore.consumePair(loaded);
        await reconcileExactRemovalIntents(loaded.cache);
      } catch (error) {
        throw new Error(
          "Project update committed successfully, but the exact authenticated changeset pair could not be consumed; project files remain applied and remaining cache evidence was preserved",
          { cause: error }
        );
      }
      return {
        applied: true,
        changesetId: request.changesetId,
        changes: changeset.changes.map(({ previousHash: _previousHash, managedBlocks: _managedBlocks, ...change }) => change)
      };
    });
  }
  return { previewUpdate, inspectChangesetForApproval, issueApplyAuthorization, applyUpdate };
}

// src/knowledge/history.ts
import { createHash as createHash10 } from "node:crypto";
import { lstat as lstat10, open as open10, realpath as realpath8 } from "node:fs/promises";
import { isAbsolute as isAbsolute6, relative as relative6, resolve as resolve8, sep as sep5 } from "node:path";
import { TextDecoder as TextDecoder5 } from "node:util";
function sha2562(value) {
  return `sha256:${createHash10("sha256").update(value).digest("hex")}`;
}
function inside2(root, target) {
  const difference = relative6(root, target);
  return difference === "" || !difference.startsWith(`..${sep5}`) && difference !== ".." && !isAbsolute6(difference);
}
function normalized2(value) {
  return JSON.stringify(value).normalize("NFKC").toLocaleLowerCase("en-US");
}
function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
async function safeRead(root, path, budget, label, archiveOnly = false) {
  if (!safeRepositoryPath(path) || archiveOnly && !path.startsWith("docs/project-design/archive/")) {
    throw new Error("History path is outside the managed archive");
  }
  budget.files.consume();
  budget.deadline?.check();
  const lexical = resolve8(root, ...path.split("/"));
  const metadata = await lstat10(lexical, { bigint: true });
  if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error("History path must be a regular file");
  if (metadata.size > BigInt(budget.maxFileBytes)) {
    throw new Error(`${label} exceeds the history file limit of ${budget.maxFileBytes} bytes`);
  }
  const size = Number(metadata.size);
  if (!Number.isSafeInteger(size) || size < 0) throw new Error(`${label} has an invalid byte length`);
  budget.bytes.consume(size);
  const canonical2 = await realpath8(lexical);
  if (!inside2(root, canonical2) || canonical2 !== lexical) throw new Error("History path resolves outside the repository");
  const handle = await open10(canonical2, "r");
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.dev !== metadata.dev || before.ino !== metadata.ino || before.size !== metadata.size) {
      throw new Error(`${label} identity or byte length changed before bounded read`);
    }
    const bytes = Buffer.allocUnsafe(size);
    let offset = 0;
    while (offset < size) {
      budget.deadline?.check();
      const result = await handle.read(bytes, offset, size - offset, offset);
      if (result.bytesRead === 0) throw new Error(`${label} ended during bounded read`);
      offset += result.bytesRead;
    }
    const overflow = Buffer.allocUnsafe(1);
    if ((await handle.read(overflow, 0, 1, size)).bytesRead !== 0) {
      throw new Error(`${label} exceeded its validated byte length during bounded read`);
    }
    const after = await handle.stat({ bigint: true });
    if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || !after.isFile() || after.isSymbolicLink()) {
      throw new Error(`${label} identity or byte length changed during bounded read`);
    }
    const finalCanonical = await realpath8(lexical);
    if (finalCanonical !== canonical2 || !inside2(root, finalCanonical)) {
      throw new Error(`${label} path changed during bounded read`);
    }
    return bytes;
  } finally {
    await handle.close();
  }
}
function boundedHistoryItem(item) {
  const record = item.record && typeof item.record === "object" && !Array.isArray(item.record) ? item.record : void 0;
  const tombstone = item.tombstone && typeof item.tombstone === "object" && !Array.isArray(item.tombstone) ? item.tombstone : void 0;
  const bytes = Buffer.byteLength(JSON.stringify(item), "utf8");
  if (bytes <= 128 * 1024) return item;
  const statement = typeof record?.statement === "string" ? record.statement : void 0;
  return {
    source: item.source,
    ...item.generationId ? { generationId: item.generationId } : {},
    ...record ? { record: {
      id: record.id,
      kind: record.kind,
      ownerDocument: record.ownerDocument,
      scope: record.scope,
      lifecycle: record.lifecycle,
      ...statement ? { statement: statement.slice(0, 64 * 1024) } : {}
    } } : {},
    ...tombstone ? { tombstone } : {},
    truncated: true,
    originalBytes: bytes
  };
}
function evidencePaths2(record) {
  if (!Array.isArray(record.evidence)) return [];
  return record.evidence.flatMap((evidence) => {
    if (typeof evidence === "string") {
      const match = /^(.*):[0-9]+$/u.exec(evidence);
      return match ? [match[1]] : [];
    }
    if (evidence && typeof evidence === "object" && typeof evidence.path === "string") {
      return [evidence.path];
    }
    return [];
  });
}
function updateHashFrame(hasher, label, bytes) {
  const labelBytes = Buffer.from(label, "utf8");
  const header = Buffer.allocUnsafe(8);
  header.writeUInt32BE(labelBytes.byteLength, 0);
  header.writeUInt32BE(bytes.byteLength, 4);
  hasher.update(header).update(labelBytes).update(bytes);
}
function freshnessFailureState(error) {
  const message = error instanceof Error ? error.message : "";
  if (/deadline/iu.test(message)) return "unavailable:deadline";
  if (/exceeds.*limit|file limit|aggregate bytes|freshness files/iu.test(message)) return "unavailable:resource-limit";
  if (/identity|changed during|ended during|validated byte length|path changed/iu.test(message)) return "unavailable:unstable";
  if (/regular file|outside the repository|invalid byte length/iu.test(message)) return "unavailable:unreadable";
  const code = error?.code;
  if (code === "ENOENT") return "missing";
  if (typeof code === "string") return "unavailable:unreadable";
  return void 0;
}
async function sourceFreshness(root, sourceRevision, budget) {
  const stale = /* @__PURE__ */ new Set();
  const snapshot2 = createHash10("sha256");
  for (const [path, expected] of Object.entries(sourceRevision.files).sort(([left], [right]) => left.localeCompare(right, "en-US"))) {
    let state;
    try {
      const actual = sha2562(await safeRead(root, path, budget, `History source ${path}`));
      if (actual !== expected) stale.add(windowsRepositoryPathKey(path));
      state = actual;
    } catch (error) {
      const failure = freshnessFailureState(error);
      if (!failure) throw error;
      stale.add(windowsRepositoryPathKey(path));
      state = failure;
    }
    updateHashFrame(snapshot2, windowsRepositoryPathKey(path), Buffer.from(state, "utf8"));
  }
  return { stale, snapshot: snapshot2.digest() };
}
function lifecycleState(record) {
  const lifecycle = record.lifecycle;
  return lifecycle && typeof lifecycle === "object" && !Array.isArray(lifecycle) && typeof lifecycle.state === "string" ? lifecycle.state : record.status === "superseded" ? "terminal" : "active";
}
function recordMatches(record, input) {
  const ids = stringArray(input.recordIds);
  if (ids.length > 0 && (typeof record.id !== "string" || !ids.includes(record.id))) return false;
  const query = typeof input.query === "string" ? input.query.normalize("NFKC").toLocaleLowerCase("en-US") : "";
  if (query && !normalized2(record).includes(query)) return false;
  const paths = stringArray(input.paths);
  if (paths.length > 0 && !evidencePaths2(record).some((path) => paths.some((requested) => {
    const candidate = windowsRepositoryPathKey(path);
    const selected2 = windowsRepositoryPathKey(requested).replace(/\/$/u, "");
    return candidate === selected2 || candidate.startsWith(`${selected2}/`) || selected2.startsWith(`${candidate}/`);
  }))) return false;
  const modules = stringArray(input.modules).map((value) => value.toLocaleLowerCase("en-US"));
  if (modules.length > 0) {
    const values = [...stringArray(record.modules), ...stringArray(record.module), typeof record.scope === "string" ? record.scope : ""].flatMap((value) => value.split(/[^A-Za-z0-9_-]+/u)).map((value) => value.toLocaleLowerCase("en-US"));
    if (!modules.some((value) => values.includes(value))) return false;
  }
  return true;
}
function filterKey(input) {
  return sha2562(JSON.stringify({
    query: typeof input.query === "string" ? input.query : "",
    recordIds: stringArray(input.recordIds),
    paths: stringArray(input.paths),
    modules: stringArray(input.modules),
    includeTombstones: input.includeTombstones === true
  }));
}
async function queryHistory(input, options = {}) {
  if (typeof input.root !== "string") throw new Error("A repository root is required");
  const limit = input.limit === void 0 ? 50 : Number(input.limit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error("History limit must be an integer between 1 and 500");
  const root = await realpath8(resolve8(input.root));
  const limits = resolveKeeperLimits(options.limits);
  const historyBudget = {
    maxFileBytes: limits.preview.maxFileBytes,
    bytes: new ByteBudget("History aggregate bytes", limits.preview.maxAggregateBytes),
    files: new CounterBudget("History files", 4)
  };
  const manifestBytes = await safeRead(
    root,
    "docs/project-design/manifest.json",
    historyBudget,
    "History manifest"
  );
  let manifestValue;
  try {
    if (manifestBytes.length >= 3 && manifestBytes[0] === 239 && manifestBytes[1] === 187 && manifestBytes[2] === 191) {
      throw new Error("UTF-8 BOM is not canonical");
    }
    manifestValue = JSON.parse(new TextDecoder5("utf-8", { fatal: true }).decode(manifestBytes));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`History manifest is invalid: ${detail}`);
  }
  const historyFiles = [{
    label: "docs/project-design/manifest.json",
    bytes: manifestBytes
  }];
  const loaded = await loadAndValidateHistoryOverlay(manifestValue, async (path) => {
    let bytes;
    try {
      bytes = await safeRead(root, path, historyBudget, `History archive ${path}`, true);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    historyFiles.push({ label: path, ...bytes ? { bytes } : {} });
    return bytes;
  });
  const manifest2 = loaded.pack;
  const parsedGenerations = loaded.generations;
  const parsedTombstones = loaded.tombstones;
  const freshnessBudget = {
    maxFileBytes: limits.scan.maxFileBytes,
    bytes: new ByteBudget("History freshness bytes", limits.scan.maxAggregateBytes),
    files: new CounterBudget("History freshness files", limits.scan.maxFiles),
    deadline: new DeadlineBudget("History freshness scan", limits.scan.deadlineMs)
  };
  const freshness = await sourceFreshness(root, manifest2.sourceRevision, freshnessBudget);
  const stale = freshness.stale;
  const revisionPaths = new Set(Object.keys(manifest2.sourceRevision.files).map(windowsRepositoryPathKey));
  const items = [];
  for (const parsedRecord of manifest2.records) {
    const record = parsedRecord;
    const state = lifecycleState(record);
    const isStale = evidencePaths2(record).some((path) => {
      const key = windowsRepositoryPathKey(path);
      return !revisionPaths.has(key) || stale.has(key);
    });
    if (state === "terminal" && recordMatches(record, input)) items.push({ source: "active-terminal", record });
    else if (state === "active" && isStale && recordMatches(record, input)) items.push({ source: "active-stale", record });
  }
  for (const generation of parsedGenerations) {
    for (const parsedEntry of generation.entries) {
      const record = parsedEntry.record;
      if (recordMatches(record, input)) {
        items.push({
          source: "archive",
          generationId: generation.metadata.id,
          record,
          archive: parsedEntry
        });
      }
    }
  }
  if (input.includeTombstones === true) {
    for (const parsedTombstone of parsedTombstones) {
      const tombstone = parsedTombstone;
      if (recordMatches(tombstone, input)) items.push({ source: "tombstone", tombstone });
    }
  }
  const snapshotHasher = createHash10("sha256");
  for (const file of historyFiles) {
    updateHashFrame(snapshotHasher, file.label, file.bytes ?? Buffer.from("missing", "utf8"));
  }
  updateHashFrame(snapshotHasher, "source-freshness", freshness.snapshot);
  const snapshotId = `sha256:${snapshotHasher.digest("hex")}`;
  const expectedFilterKey = filterKey(input);
  const now = options.now?.() ?? Date.now();
  const newCursorExpiresAt = cursorExpiresAt(now);
  const codec = await createCursorCodec(options, root);
  const decoded = typeof input.cursor === "string" ? codec.decode(input.cursor, parseHistoryCursorPayload) : void 0;
  if (decoded && (decoded.snapshotId !== snapshotId || decoded.filterKey !== expectedFilterKey)) {
    throw new Error("History cursor does not match the current snapshot or filters");
  }
  if (decoded) assertCursorCurrent(decoded, now);
  if (input.cursor !== void 0 && typeof input.cursor !== "string") throw new Error("History cursor must be a string");
  const offset = decoded?.offset ?? 0;
  if (offset > items.length) throw new Error("History cursor offset is outside the result set");
  const pageItems2 = [];
  let pageBytes = 0;
  for (const item of items.slice(offset, offset + limit)) {
    const bounded = boundedHistoryItem(item);
    const itemBytes = Buffer.byteLength(JSON.stringify(bounded), "utf8");
    if (pageItems2.length > 0 && pageBytes + itemBytes > 900 * 1024) break;
    pageItems2.push(bounded);
    pageBytes += itemBytes;
  }
  const nextOffset = offset + pageItems2.length;
  const complete = nextOffset >= items.length;
  const page = {
    limit,
    complete,
    ...!complete ? { nextCursor: codec.encode({
      version: 2,
      snapshotId,
      filterKey: expectedFilterKey,
      offset: nextOffset,
      issuedAt: decoded?.issuedAt ?? now,
      expiresAt: decoded?.expiresAt ?? newCursorExpiresAt
    }) } : {}
  };
  const result = { schemaVersion: 3, snapshotId, items: pageItems2, page };
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > 1024 * 1024) throw new Error("History response exceeds the one MiB response budget");
  return result;
}

// src/index.ts
function createProjectDesignKeeper(options = {}) {
  const trustedApprovalProvider = options.trustedApprovalProvider;
  const transactions = createTransactionService(options);
  const scope = createScopeService(options);
  const validatePackWithOptions = (input) => validatePack(input, {
    limits: options.limits,
    io: options.validationIo
  });
  const applyUpdate = async (input) => {
    if (!trustedApprovalProvider) {
      throw new Error("Direct apply requires a trusted approval provider");
    }
    const binding = await transactions.inspectChangesetForApproval(input);
    const decision = await trustedApprovalProvider(binding);
    if (decision?.approved !== true) throw new Error("Trusted approval provider declined the apply request");
    const requestIdentity = Object.freeze({ directApply: true });
    const authorization = transactions.issueApplyAuthorization(binding, requestIdentity);
    return transactions.applyUpdate(input, authorization, requestIdentity);
  };
  return {
    ...scope,
    queryHistory: (input) => queryHistory(input, options),
    analyzeRedundancy: (input) => analyzeRedundancy(input, options),
    validatePack: validatePackWithOptions,
    previewUpdate: transactions.previewUpdate,
    inspectChangesetForApproval: transactions.inspectChangesetForApproval,
    issueApplyAuthorization: transactions.issueApplyAuthorization,
    applyUpdateDirect: transactions.applyUpdate,
    applyUpdate
  };
}
var projectDesignKeeper = createProjectDesignKeeper();

// src/tools/keeper-tools.ts
import { defineTool } from "@deepseek-ai/dsh-tools";

// src/tools/schemas.ts
function boundedString(maxBytes, minimum = 0) {
  return external_exports.string().min(minimum).max(maxBytes).superRefine((value, context) => {
    try {
      assertStringWithin("tool string", value, maxBytes);
    } catch (error) {
      context.addIssue({ code: external_exports.ZodIssueCode.custom, message: error instanceof Error ? error.message : "Tool string exceeds its byte limit" });
    }
  });
}
var nonemptyString = boundedString(4 * 1024, 1);
var nonemptyQuery = boundedString(32 * 1024, 1);
var queryString = boundedString(32 * 1024);
var proposedFileContent = boundedString(keeperLimits.preview.maxFileBytes);
var fingerprint = external_exports.string().regex(/^sha256:[a-f0-9]{64}$/u);
var fingerprintRecord = external_exports.record(fingerprint);
var snapshotInput = external_exports.union([
  fingerprintRecord,
  external_exports.object({ files: fingerprintRecord }).passthrough()
]);
var sourceRevisionInput = external_exports.object({ files: fingerprintRecord }).passthrough();
var changesetAdapterInput = external_exports.object({ changesetId: nonemptyString }).strict();
var stringOrStrings = external_exports.union([nonemptyString, external_exports.array(nonemptyString).nonempty().max(1e3)]);
var scopeFields = {
  root: nonemptyString.optional(),
  path: nonemptyString.optional()
};
var pageLimit = external_exports.number().int().min(1).max(1e3);
function scoped(shape) {
  return external_exports.object({ ...scopeFields, ...shape }).strict();
}
var scanInput = scoped({
  previousSnapshot: snapshotInput.optional(),
  view: external_exports.enum(["summary", "files", "evidence"]).optional(),
  cursor: nonemptyString.optional(),
  limit: pageLimit.optional()
});
var searchInput = scoped({
  query: nonemptyQuery,
  domain: stringOrStrings.optional(),
  domains: stringOrStrings.optional(),
  status: stringOrStrings.optional(),
  statuses: stringOrStrings.optional()
});
var driftInput = scoped({
  previousSnapshot: snapshotInput.optional(),
  sourceRevision: sourceRevisionInput.optional(),
  pack: external_exports.record(external_exports.unknown()).optional(),
  requiredEvidence: external_exports.array(nonemptyString).max(keeperLimits.pack.maxEvidencePerRecord).optional(),
  view: external_exports.enum(["summary", "details"]).optional(),
  cursor: nonemptyString.optional(),
  limit: pageLimit.optional()
});
var contextInput = scoped({
  query: queryString.optional(),
  paths: external_exports.array(nonemptyString).max(1e3).optional(),
  path: nonemptyString.optional(),
  module: stringOrStrings.optional(),
  modules: stringOrStrings.optional(),
  maxRecords: external_exports.number().int().min(1).max(100).optional(),
  maxEvidence: external_exports.number().int().min(1).max(500).optional()
});
var historyInput = external_exports.object({
  root: nonemptyString,
  query: queryString.optional(),
  recordIds: external_exports.array(nonemptyString).max(1e3).optional(),
  paths: external_exports.array(nonemptyString).max(1e3).optional(),
  modules: external_exports.array(nonemptyString).max(1e3).optional(),
  includeTombstones: external_exports.boolean().optional(),
  cursor: nonemptyString.optional(),
  limit: external_exports.number().int().min(1).max(500).optional()
}).strict();
var redundancyInput = external_exports.object({
  root: nonemptyString,
  query: queryString.optional(),
  paths: external_exports.array(nonemptyString).max(1e3).optional(),
  modules: external_exports.array(nonemptyString).max(1e3).optional()
}).strict();
var validateInput = external_exports.object({
  root: nonemptyString,
  pack: external_exports.record(external_exports.unknown())
}).strict();
var managedBlock = external_exports.union([
  external_exports.object({ recordId: nonemptyString, content: proposedFileContent }).strict(),
  external_exports.object({ recordId: nonemptyString, delete: external_exports.literal(true) }).strict()
]);
var expectedContentHash = external_exports.string().regex(/^sha256:[a-f0-9]{64}$/u);
var requestedChange = external_exports.union([
  external_exports.object({
    path: nonemptyString,
    content: proposedFileContent,
    expectedContentHash: expectedContentHash.optional()
  }).strict(),
  external_exports.object({
    path: nonemptyString,
    delete: external_exports.literal(true),
    expectedContentHash: expectedContentHash.optional()
  }).strict(),
  external_exports.object({
    path: nonemptyString,
    managedBlock,
    expectedContentHash: expectedContentHash.optional()
  }).strict()
]);
var previewInput = external_exports.object({
  root: nonemptyString,
  path: nonemptyString.optional(),
  changes: external_exports.array(requestedChange).nonempty().max(keeperLimits.preview.maxChanges),
  expectedContentHash: expectedContentHash.optional(),
  pack: external_exports.record(external_exports.unknown()).optional(),
  analysisId: nonemptyString.optional(),
  redundancyDecisions: external_exports.array(external_exports.object({
    candidateId: nonemptyString,
    decision: external_exports.enum(["merge", "keep-separate", "defer"]),
    survivorId: nonemptyString.optional()
  }).strict()).nonempty().max(keeperLimits.redundancy.maxDecisions).optional()
}).strict();
var applyInput = external_exports.object({
  root: nonemptyString,
  changesetId: nonemptyString.optional(),
  changeset: changesetAdapterInput.optional()
}).strict();
function parseToolInput(schema, input) {
  return schema.parse(input);
}

// src/tools/apply-approval.ts
function approvalMessage(binding) {
  const escapeFormatControls = (value) => value.replace(
    /[\u007f-\u009f\p{Cf}\p{Zl}\p{Zp}]/gu,
    (character) => `\\u${character.codePointAt(0).toString(16).padStart(4, "0")}`
  );
  const summaryJson = escapeFormatControls(JSON.stringify({
    root: binding.root,
    changesetId: binding.changesetId,
    diffDigest: binding.diffDigest,
    expiresAt: new Date(binding.expiresAt).toISOString(),
    summary: binding.summary,
    paths: binding.paths,
    archiveActions: binding.archiveActions,
    semanticDecisionIds: binding.semanticDecisionIds
  }, null, 2));
  const message = [
    "Approve this authenticated Project Design Keeper changeset?",
    summaryJson,
    `Select approve and type the final eight hexadecimal digest characters: ${binding.diffDigest.slice(-8)}`
  ].join("\n");
  assertStringWithin("Approval summary", message, 1024 * 1024);
  return message;
}
function approvalDigestSuffix(binding) {
  return binding.diffDigest.slice(-8);
}
var requestIdentityBase = Object.freeze({ source: "dsh-plugin" });
async function elicitApplyApproval(services, issueAuthorization, binding, identity) {
  if (identity.agent === void 0) {
    throw new Error("Apply approval requires a live calling agent; refusing to apply without one");
  }
  const requestIdentity = Object.freeze({
    ...requestIdentityBase,
    callId: identity.callId,
    agentId: identity.agent.id
  });
  const outcome = await services.approval.request({
    agent: identity.agent,
    toolName: "apply_update",
    callId: identity.callId,
    reason: approvalMessage(binding),
    signal: identity.signal
  });
  if (outcome !== "allowed-once") {
    throw new Error(approvalOutcomeMessage(outcome));
  }
  if (services.requireDigestConfirmation) {
    await confirmDigest(services, binding, identity);
  }
  return {
    authorization: issueAuthorization(binding, requestIdentity),
    requestIdentity
  };
}
function approvalOutcomeMessage(outcome) {
  switch (outcome) {
    case "rejected":
      return "Apply approval was declined";
    case "cancelled":
      return "Apply approval was cancelled";
    case "unavailable":
      return "Apply approval is unavailable in this session (no answerer); the apply request is rejected";
    default:
      return `Apply approval returned an unexpected outcome: ${outcome}`;
  }
}
async function confirmDigest(services, binding, identity) {
  const userQuestions = services.userQuestions;
  if (userQuestions === void 0) {
    throw new Error(
      "Digest confirmation requires the user-questions capability, which is not mounted in this session; the apply request is rejected. Disable digest confirmation only when a trusted approval provider is used."
    );
  }
  const suffix = approvalDigestSuffix(binding);
  const summaryJson = JSON.stringify({
    root: binding.root,
    changesetId: binding.changesetId,
    diffDigest: binding.diffDigest,
    expiresAt: new Date(binding.expiresAt).toISOString(),
    summary: binding.summary,
    paths: binding.paths,
    archiveActions: binding.archiveActions,
    semanticDecisionIds: binding.semanticDecisionIds
  }, null, 2);
  const answer = await userQuestions.ask({
    agent: identity.agent,
    signal: identity.signal,
    questions: [{
      id: "keeper-apply-digest",
      header: "Apply approval",
      question: `Approve this Project Design Keeper changeset? Type the final eight hexadecimal digest characters (${suffix}) to approve, or type "decline" to refuse.`,
      detail: summaryJson
    }]
  });
  const item = answer.answers.find((entry) => entry.id === "keeper-apply-digest");
  const custom2 = item?.custom?.trim().toLowerCase() ?? "";
  if (custom2 === "decline") throw new Error("Apply approval was declined");
  if (!/^[a-f0-9]{8}$/u.test(custom2) || custom2 !== suffix) {
    throw new Error("Apply approval digest confirmation does not match");
  }
}

// src/tools/keeper-tools.ts
var readOnly = {
  schema: { type: "object", additionalProperties: true },
  render: (_args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }]
};
function requireScope(input) {
  if (!input.root && !input.path) throw new Error("A repository root or path is required");
}
function keeperOperation(schema, operation, scopeCheck = false) {
  return async (args, _exec) => {
    assertSerializedWithin("Tool arguments", args, keeperLimits.mcpArgumentBytes);
    const input = parseToolInput(schema, args);
    if (scopeCheck) requireScope(input);
    const value = await operation(input);
    assertToolResultBudget(value);
    return value;
  };
}
function requireApplyChangeset(input) {
  const adapter = input.changeset;
  if (!input.changesetId && !adapter?.changesetId) throw new Error("A changeset id is required");
}
function registerKeeperTools(register, service, approval) {
  register(defineTool({
    name: "scan_scope",
    description: "Scan a repository scope and return a bounded summary or cursor-paged files/evidence for an immutable snapshot.",
    parameters: {
      root: { type: "string", description: "Repository root path; defaults to the repository containing path." },
      path: { type: "string", description: "Explicit file or directory path to scope." },
      previousSnapshot: { type: "json", description: "Prior immutable snapshot to compare against." },
      view: { type: "string", enum: ["summary", "files", "evidence"], description: "Which bounded projection to return." },
      cursor: { type: "string", description: "Opaque pagination cursor from the previous page." },
      limit: { type: "number", description: "Maximum page size (1-1000)." }
    },
    output: readOnly,
    execute: keeperOperation(scanInput, service.scanScope, true)
  }));
  register(defineTool({
    name: "search_evidence",
    description: "Search repository evidence by query and optional design classifications.",
    parameters: {
      root: { type: "string", description: "Repository root path; defaults to the repository containing path." },
      path: { type: "string", description: "Explicit file or directory path to search within." },
      query: { type: "string", required: true, description: "Search query text." },
      domain: { type: "string", description: "Design domain filter (string or array)." },
      domains: { type: "string", description: "Design domain filter (string or array)." },
      status: { type: "string", description: "Evidence status filter (string or array)." },
      statuses: { type: "string", description: "Evidence status filter (string or array)." }
    },
    output: readOnly,
    execute: keeperOperation(searchInput, service.searchEvidence, true)
  }));
  register(defineTool({
    name: "detect_drift",
    description: "Compare current source evidence with a prior snapshot or design pack.",
    parameters: {
      root: { type: "string", description: "Repository root path; defaults to the repository containing path." },
      path: { type: "string", description: "Explicit file or directory path to scope." },
      previousSnapshot: { type: "json", description: "Prior immutable snapshot to compare against." },
      sourceRevision: { type: "json", description: "Source revision fingerprints." },
      pack: { type: "object", additionalProperties: true, description: "Design pack whose required evidence is checked." },
      requiredEvidence: { type: "array", items: { type: "string" }, description: "Evidence selectors that must be supported." },
      view: { type: "string", enum: ["summary", "details"], description: "Detail level of the drift report." },
      cursor: { type: "string", description: "Opaque pagination cursor from the previous page." },
      limit: { type: "number", description: "Maximum page size (1-1000)." }
    },
    output: readOnly,
    execute: keeperOperation(driftInput, service.detectDrift, true)
  }));
  register(defineTool({
    name: "query_context",
    description: "Return the smallest relevant design context for a task, path, or module.",
    parameters: {
      root: { type: "string", description: "Repository root path; defaults to the repository containing path." },
      path: { type: "string", description: "Explicit file or directory path whose context is loaded." },
      query: { type: "string", description: "Free-text relevance query." },
      paths: { type: "array", items: { type: "string" }, description: "Explicit repository-relative paths to load." },
      module: { type: "string", description: "Module selector (string or array)." },
      modules: { type: "string", description: "Module selector (string or array)." },
      maxRecords: { type: "number", description: "Maximum design records to return (1-100)." },
      maxEvidence: { type: "number", description: "Maximum evidence entries to return (1-500)." }
    },
    output: readOnly,
    execute: keeperOperation(contextInput, service.queryContext, true)
  }));
  register(defineTool({
    name: "query_history",
    description: "Query stale, terminal, archived, and optionally tombstoned project-design knowledge.",
    parameters: {
      root: { type: "string", required: true, description: "Repository root path." },
      query: { type: "string", description: "Free-text history query." },
      recordIds: { type: "array", items: { type: "string" }, description: "Explicit record ids to load." },
      paths: { type: "array", items: { type: "string" }, description: "Repository-relative paths to filter by." },
      modules: { type: "array", items: { type: "string" }, description: "Module names to filter by." },
      includeTombstones: { type: "boolean", description: "Whether tombstoned records are included." },
      cursor: { type: "string", description: "Opaque pagination cursor from the previous page." },
      limit: { type: "number", description: "Maximum page size (1-500)." }
    },
    output: readOnly,
    execute: keeperOperation(historyInput, service.queryHistory)
  }));
  register(defineTool({
    name: "analyze_redundancy",
    description: "Find deterministic semantic-redundancy candidates for explicit Agent and user decisions.",
    parameters: {
      root: { type: "string", required: true, description: "Repository root path." },
      query: { type: "string", description: "Free-text query to focus analysis." },
      paths: { type: "array", items: { type: "string" }, description: "Repository-relative paths to filter by." },
      modules: { type: "array", items: { type: "string" }, description: "Module names to filter by." }
    },
    output: readOnly,
    execute: keeperOperation(redundancyInput, service.analyzeRedundancy)
  }));
  register(defineTool({
    name: "preview_update",
    description: "Validate a proposed managed update, store an expiring change-set in keeper cache, and return its diff and conflicts without changing the project.",
    parameters: {
      root: { type: "string", required: true, description: "Repository root path." },
      path: { type: "string", description: "Optional path constraint for the change-set." },
      changes: {
        type: "array",
        required: true,
        description: "Proposed changes (write, delete, or managed-block updates).",
        items: {
          type: "object",
          additionalProperties: true,
          properties: {
            path: { type: "string", required: true, description: "Repository-relative output path." },
            content: { type: "string", description: "Full replacement content." },
            delete: { type: "boolean", description: "True deletes the path." },
            managedBlock: {
              type: "object",
              additionalProperties: true,
              description: "Managed project-design block update.",
              properties: {
                recordId: { type: "string", required: true },
                content: { type: "string", description: "Replacement block content." },
                delete: { type: "boolean", description: "True deletes the managed block." }
              }
            },
            expectedContentHash: { type: "string", description: "sha256:... expected current content hash." }
          }
        }
      },
      expectedContentHash: { type: "string", description: "sha256:... expected current content hash." },
      pack: { type: "object", additionalProperties: true, description: "Candidate design pack." },
      analysisId: { type: "string", description: "Id pairing redundancy decisions with the pack." },
      redundancyDecisions: {
        type: "array",
        description: "User decisions on redundancy candidates.",
        items: {
          type: "object",
          additionalProperties: true,
          properties: {
            candidateId: { type: "string", required: true },
            decision: { type: "string", required: true, enum: ["merge", "keep-separate", "defer"] },
            survivorId: { type: "string" }
          }
        }
      }
    },
    output: readOnly,
    execute: keeperOperation(previewInput, service.previewUpdate)
  }));
  register(defineTool({
    name: "apply_update",
    description: "Apply one explicitly confirmed, unexpired change-set with optimistic concurrency and recovery snapshots.",
    parameters: {
      root: { type: "string", required: true, description: "Repository root path." },
      changesetId: { type: "string", description: "Id of the change-set returned by preview_update." },
      changeset: {
        type: "object",
        additionalProperties: true,
        description: "Change-set adapter (changeset.changesetId).",
        properties: {
          changesetId: { type: "string", required: true }
        }
      }
    },
    output: readOnly,
    async execute(args, exec) {
      assertSerializedWithin("Tool arguments", args, keeperLimits.mcpArgumentBytes);
      const input = parseToolInput(applyInput, args);
      requireApplyChangeset(input);
      const binding = await service.inspectChangesetForApproval(input);
      const { authorization, requestIdentity } = await elicitApplyApproval(
        approval,
        service.issueApplyAuthorization,
        binding,
        { callId: exec.callId, agent: exec.agent, signal: exec.signal }
      );
      const value = await service.applyUpdateDirect(input, authorization, requestIdentity);
      assertToolResultBudget(value);
      return value;
    }
  }));
  register(defineTool({
    name: "validate_pack",
    description: "Validate a project-design knowledge pack, links, records, evidence, and ownership metadata.",
    parameters: {
      root: { type: "string", required: true, description: "Repository root path." },
      pack: { type: "object", additionalProperties: true, required: true, description: "The design pack to validate." }
    },
    output: readOnly,
    execute: keeperOperation(validateInput, service.validatePack)
  }));
}

// src/plugin.ts
var name = "project-design-keeper";
var inject = ["tools", "approval"];
var Config = z.object({
  cacheDirectory: z.string(),
  homeDirectory: z.string(),
  requireDigestConfirmation: z.boolean().default(true),
  limits: z.any()
});
function apply(ctx, config = {}) {
  const runtime = createProjectDesignKeeper({
    cacheDirectory: config.cacheDirectory,
    homeDirectory: config.homeDirectory,
    limits: config.limits
  });
  const userQuestions = ctx.get("userQuestions", false);
  registerKeeperTools(
    (tool) => {
      ctx.tools.register(tool);
    },
    runtime,
    {
      approval: ctx.approval,
      ...userQuestions !== void 0 ? { userQuestions } : {},
      requireDigestConfirmation: config.requireDigestConfirmation ?? true
    }
  );
}
export {
  Config,
  apply,
  inject,
  name
};
