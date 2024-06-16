import { Monitor } from './bybit-p2p-monitor';
import { MappedRenderer } from './renderer';

export function Renderable(transformer?: (value: any) => string) {
    return function (
        _: undefined,
        context: ClassFieldDecoratorContext<Monitor, string | number | { [key: string]: string | number }>
    ) {
        const key = context.name.toString();
        context.addInitializer(function () {
            const renderer = (this as any).renderer as MappedRenderer;
            const isObject = typeof this[key] === 'object';
            if (isObject) {
                const obj = this[key];
                for (const k in obj) {
                    if (k == 'milliseconds') continue;
                    obj[`_${k}`] = obj[k];
                    const set = transformer ? (value: any) => {
                        obj[`_${k}`] = value;
                        renderer.renderValue(k, transformer(value));
                    } : (value: any) => {
                        obj[`_${k}`] = value;
                        renderer.renderValue(k, value);
                    }
                    Object.defineProperty(obj, k, {
                        set,
                        get: () => {
                            return obj[`_${k}`]
                        },
                    })
                }
                return;
            }
            this[`_${key}`] = this[key];
            context.access.get = (object: any) => {
                return object[`_${key}`];
            };
            if (transformer) {
                context.access.set = (object: any, value: any) => {
                    object[`_${key}`] = value;
                    renderer.renderValue(key, transformer(value));
                };
            } else {
                context.access.set = (object: any, value: any) => {
                    object[`_${key}`] = value;
                    renderer.renderValue(key, value);
                };
            }
        })
        return (initValue: any) => initValue;
    }
    
}