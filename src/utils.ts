import { MappedRenderer } from './renderer';

export function makeRendereableProperty<T extends Record<Key, T[Key]>, Key extends keyof T & string>(
    renderer: MappedRenderer,
    options: {
        key: Key;
        renderKeyPrefix?: string;
        target: T;
        transformer?: (value: any) => string;
        exclude?: (keyof T[Key])[];
        include?: (keyof T[Key])[];
    },
) {
    const { key, target, transformer, exclude, include, renderKeyPrefix: rkp } = options;
    const isObject = typeof target[key] === 'object';
    if (isObject) {
        const obj = target[key];

        for (const k in obj) {
            if (exclude?.includes(k)) continue;
            if (include && !include.includes(k)) continue;
            const pKey = `_${k}` as keyof typeof obj;
            const renderKey = rkp ? `${rkp}.${k}` : k;
            const set = transformer
                ? (value: any) => {
                      obj[pKey] = value;
                      renderer.renderValue(renderKey, transformer(value));
                  }
                : (value: any) => {
                      obj[pKey] = value;
                      renderer.renderValue(renderKey, value);
                  };
            obj[pKey] = obj[k];
            Object.defineProperty(obj, k, {
                set,
                get: () => {
                    return obj[pKey];
                },
            });
        }
        return;
    }

    const pKey = `_${key}` as keyof typeof target;
    const renderKey = rkp ? `${rkp}.${key}` : key;
    target[pKey] = target[key] as any;
    const set = transformer
        ? (value: any) => {
              target[pKey] = value;
              renderer.renderValue(renderKey, transformer(value));
          }
        : (value: any) => {
              target[pKey] = value;
              renderer.renderValue(renderKey, value);
          };
    if (transformer) {
        Object.defineProperty(target, key, {
            set,
            get: () => {
                return target[pKey];
            },
        });
    } else {
        Object.defineProperty(target, key, {
            set,
            get: () => {
                return target[pKey];
            },
        });
    }
}

export function autoBind(target: any) {
    const prototype = Object.getPrototypeOf(target);
    for (const key of Reflect.ownKeys(prototype)) {
        if (key === 'constructor') {
            continue;
        }

        const descriptor = Reflect.getOwnPropertyDescriptor(prototype, key);
        if (descriptor && typeof descriptor.value === 'function') {
            target[key] = target[key].bind(target);
        }
    }
}
