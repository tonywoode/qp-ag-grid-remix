import { Link } from '@remix-run/react'
import { AiFillFolder, AiFillFile } from 'react-icons/ai'
import { MdArrowRight, MdArrowDropDown } from 'react-icons/md'

const Node = ({ node, style, dragHandle, tree }) => {
  //console.log('icon', node.data.iconLink)
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
        <ul>
          {' '}
          <li>
            {' '}
            <Link to={`grid`}>Load the n64 romdata</Link>{' '}
          </li>{' '}
        </ul>
        {node.isLeaf ? (
          <>
            <span className="arrow" style={{ marginRight: '2px' }}></span>
            <span className="file-folder-icon" style={{ marginRight: '6px' }}>
              <AiFillFile color="#6bc7f6" />
            </span>
          </>
        ) : (
          <>
            <span className="arrow" style={{ marginRight: '2px' }}>
              {node.isOpen ? <MdArrowDropDown /> : <MdArrowRight />}
            </span>
            <span className="file-folder-icon" style={{ marginRight: '6px' }}>
              {node.data.iconLink ? (
                <img src={node.data.iconLink} alt="folder-icon" style={{ width: '32px', height: '32px' }} />
              ) : (
                <AiFillFolder color="#f6cf60" />
              )}
            </span>
          </>
        )}
        <span className="node-text">
          <span>{node.data.name}</span>
        </span>
      </div>
    </div>
  )
}

export { Node }