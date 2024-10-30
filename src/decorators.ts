import { MappedRenderer } from './renderer.ts';
import { MakeRendereableProperty } from './types.ts';
import { makeRendereableProperty } from './utils.ts';

export function Renderable<T>(
	options?: Pick<
		Parameters<MakeRendereableProperty>[1],
		'include' | 'exclude' | 'renderKeyPrefix' | 'transformer'
	>,
) {
	console.log('Renderable 1', options);
	return function (
		_: undefined,
		context: ClassFieldDecoratorContext<
			T,
			string | number | { [key: string]: string | number }
		>,
	) {
		console.log('Renderable 2', context);
		const key = context.name.toString() as keyof T & string;

		context.addInitializer(function () {
			const renderer = (this as any).renderer as MappedRenderer;
			if (!renderer) {
				throw new Error('No renderer found in class');
			}
			console.log('ADDING INITIALIZER FOR', key);

			makeRendereableProperty(renderer, {
				...(options as any),
				target: this,
				key,
			});
		});

		return (initValue: any) => initValue;
	};
}
