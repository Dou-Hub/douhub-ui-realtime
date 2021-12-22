# douhub-ui-realtime

if run into error below, 

Cannot find name 'StaticImageData'
declare type StaticImport = StaticRequire | StaticImageData;

manually add the code below into the corresponding file

```js
type StaticImageData = {
    src: string;
    height: number;
    width: number;
    placeholder?: string;
  };
```