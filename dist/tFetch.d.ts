import type { TypedFetchConfig, TypedFetchRequestInit, TypedFetchSuccessStatuses } from "./core/types";
type JsonBodyPrimitive = string | number | boolean | null;
export type JsonBodyValue = JsonBodyPrimitive | JsonBodyValue[] | {
    [key: string]: JsonBodyValue | undefined;
};
export interface TypedFetchGeneratedResponses {
}
/**
 * Manual request-body map keyed by endpointKey.
 *
 * Users can augment this interface in their own declaration files to enforce
 * request body types per endpoint.
 */
export interface TypedFetchGeneratedRequests {
}
type KnownEndpointKey = keyof TypedFetchGeneratedResponses & string;
type KnownRequestEndpointKey = keyof TypedFetchGeneratedRequests & string;
type StatusLike = number | `${number}`;
type ToNumericStatus<S extends StatusLike> = S extends number ? S : S extends `${infer N extends number}` ? N : number;
type KnownEndpointResult<K extends KnownEndpointKey> = {
    [S in keyof TypedFetchGeneratedResponses[K]]: {
        endpoint: K;
        status: ToNumericStatus<S & StatusLike>;
        ok: ToNumericStatus<S & StatusLike> extends TypedFetchSuccessStatuses ? true : false;
        data: TypedFetchGeneratedResponses[K][S];
        response: Response;
    };
}[keyof TypedFetchGeneratedResponses[K]];
export type TypedFetchResult<K extends string = string> = K extends KnownEndpointKey ? KnownEndpointResult<K> : {
    endpoint: K;
    status: number;
    ok: boolean;
    data: unknown;
    response: Response;
};
type TypedFetchOptions<K extends string> = {
    endpointKey: K;
    config?: Partial<TypedFetchConfig>;
    configPath?: string;
};
export type TypedFetchBody<K extends string> = K extends KnownRequestEndpointKey ? TypedFetchGeneratedRequests[K] : never;
export type TypedFetchInit<K extends string = string> = Omit<TypedFetchRequestInit, "body"> & {
    body?: BodyInit | TypedFetchBody<K> | null;
};
export declare function typedJsonBody<T extends JsonBodyValue>(value: T, options?: {
    headers?: HeadersInit;
}): Pick<RequestInit, "body" | "headers">;
export declare function typedFetch<K extends KnownRequestEndpointKey>(input: RequestInfo | URL, init: TypedFetchInit<K> | undefined, options: TypedFetchOptions<K>): Promise<TypedFetchResult<K>>;
export declare function typedFetch<K extends string = string>(input: RequestInfo | URL, init: TypedFetchRequestInit | undefined, options: TypedFetchOptions<K>): Promise<TypedFetchResult<K>>;
/**
 * Compatibility export. Existing code importing `tFetch` now receives
 * the typed status-aware helper result model.
 */
export declare function tFetch<K extends KnownRequestEndpointKey>(input: RequestInfo | URL, init: TypedFetchInit<K> | undefined, options: TypedFetchOptions<K>): Promise<TypedFetchResult<K>>;
export declare function tFetch<K extends string = string>(input: RequestInfo | URL, init: TypedFetchRequestInit | undefined, options: TypedFetchOptions<K>): Promise<TypedFetchResult<K>>;
export default typedFetch;
