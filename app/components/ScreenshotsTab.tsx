export function ScreenshotsTab({ screenshots }) {
  console.log('screenshots')
  console.log(screenshots)
  if (!screenshots || screenshots.length === 0 || screenshots[0] === null) {
    console.log('no screenshots')
    return <div>Image not found</div>
  }

  return (
    <div>
      {screenshots.map((screenshot, index) => (
        <img key={index} src={screenshot} alt={`Screenshot ${index}`} style={{ width: '100%', height: 'auto' }} />
      ))}
    </div>
  )
}
