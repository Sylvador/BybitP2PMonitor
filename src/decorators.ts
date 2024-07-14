import { Monitor } from './bybit-p2p-monitor';
import { MappedRenderer } from './renderer';
import { MakeRendereableProperty } from './types';
import { makeRendereableProperty } from './utils';

export function Renderable<T extends any>(options?: Pick<Parameters<MakeRendereableProperty>[1], 'include' | 'exclude' | 'renderKeyPrefix' | 'transformer'>) {
    return function (
        _: undefined,
        context: ClassFieldDecoratorContext<T, string | number | { [key: string]: string | number }>
    ) {
        const key = context.name.toString() as keyof T & string;
        
        context.addInitializer(function () {
            const renderer = (this as any).renderer as MappedRenderer;
            if (!renderer) {
                throw new Error('No renderer found in class');
            }
            
            makeRendereableProperty(
                renderer,
                {
                    ...options as any,
                    target: this,
                    key,
                },
            );
        })
        
        return (initValue: any) => initValue;
    }
    
}