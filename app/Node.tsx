import { Link } from '@remix-run/react'
import { AiFillFolder, AiFillFile } from 'react-icons/ai'
import { MdArrowRight, MdArrowDropDown } from 'react-icons/md'
//a react-arborist node
const Node = ({ node, style, dragHandle, tree }) => {
  console.log('icon', node.data.iconLink)
  const romdataStars = node.data.romdataLink?.replace(/\//g, '*') //restore folder paths from url encoding
  return (
    <div className="node-container" style={style} ref={dragHandle}>
      <div
        className="node-content"
        onClick={() => {
          console.log('node', node)
          console.log('romdataLink', node.data.romdataLink)
          return node.isInternal && node.toggle()
        }}
        style={{ display: 'flex', alignItems: 'center' }}
      >
        <>
          {!node.isLeaf ? (
            <span className="arrow" style={{ marginRight: '2px' }}>
              {node.isOpen ? <MdArrowDropDown /> : <MdArrowRight />}
            </span>
          ) : (
            ''
          )}
          <span className="file-folder-icon" style={{ marginRight: '6px' }}>
            {node.data.iconLink ? (
              <img src={'/' + node.data.iconLink} alt="folder-icon" style={{ width: '32px', height: '32px' }} />
            ) : (
              <AiFillFolder color={node.isLeaf ? '#6bc7f6' : '#f6cf60'} />
            )}
          </span>
        </>
        {romdataStars ? (
          <Link to={`grid/` + encodeURI(romdataStars)}>
            <span className="node-text">
              <span>{node.data.name}</span>
            </span>
          </Link>
        ) : (
          <span className="node-text">
            <span>{node.data.name}</span>
          </span>
        )}
      </div>
    </div>
  )
}

export { Node }
