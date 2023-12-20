export function ScreenshotsTab({ screenshots }) {
  return (
    <div>
      {screenshots.map((screenshot, index) => (
        <img key={index} src={screenshot} alt={`Screenshot ${index}`} />
      ))}
    </div>
  )
}
