import type { TypedFetchConfig, TypedFetchRequestInit, TypedFetchSuccessStatuses } from "./core/types";
export interface TypedFetchGeneratedResponses {
}
type KnownEndpointKey = keyof TypedFetchGeneratedResponses & string;
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
};
export declare function typedFetch<K extends string = string>(input: RequestInfo | URL, init: TypedFetchRequestInit | undefined, options: TypedFetchOptions<K>): Promise<TypedFetchResult<K>>;
/**
 * Compatibility export. Existing code importing `tFetch` now receives
 * the typed status-aware helper result model.
 */
export declare function tFetch<K extends string = string>(input: RequestInfo | URL, init: TypedFetchRequestInit | undefined, options: TypedFetchOptions<K>): Promise<TypedFetchResult<K>>;
export default typedFetch;
