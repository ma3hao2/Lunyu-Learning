// @tarojs/components mock：导出基础占位组件
const make = (name: string) => {
  const C: any = () => null;
  C.displayName = name;
  return C;
};

export const View = make('View');
export const Text = make('Text');
export const ScrollView = make('ScrollView');
export const Image = make('Image');
export const Input = make('Input');
export const Textarea = make('Textarea');
export const Button = make('Button');
export const Swiper = make('Swiper');
export const SwiperItem = make('SwiperItem');
export const Picker = make('Picker');
export const Switch = make('Switch');
