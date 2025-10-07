import TextInput from '../TextInput';

export default function TextInputExample() {
  return (
    <div className="p-6">
      <TextInput onTextSubmit={(text) => console.log('Text submitted:', text.substring(0, 100))} />
    </div>
  );
}
