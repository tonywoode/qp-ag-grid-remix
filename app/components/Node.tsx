import { Link, useLocation } from '@remix-run/react'
import { AiFillFolder, AiFillFile } from 'react-icons/ai'
import { MdArrowRight, MdArrowDropDown } from 'react-icons/md'

export function Node({ node, style, dragHandle, tree }) {
  //a react-arborist node
  const location = useLocation()
  const romdataStars = node.data.romdataLink?.replace(/\//g, '*') //restore folder paths from url encoding
  const currentURLStars = location.pathname
  const targetURLStars = `/grid/${encodeURI(romdataStars)}`
  const handleToggle = e => { e.stopPropagation();return node.isInternal && node.toggle()} // prettier-ignore
  const handleDoubleClick = e => { e.preventDefault();return node.toggle() } //prettier-ignore
  const renderNodeText = () => (
    <span className="node-text" onDoubleClick={handleDoubleClick}>
      <span>{node.data.name}</span>
    </span>
  )

  return (
    <div className="node-container" style={style} ref={dragHandle}>
      <div className="node-content" style={{ display: 'flex', alignItems: 'center' }}>
        {!node.isLeaf && (
          <span className="arrow" style={{ marginRight: '2px' }} onClick={handleToggle}>
            {node.isOpen ? <MdArrowDropDown /> : <MdArrowRight />}
          </span>
        )}
        <span className="file-folder-icon" style={{ marginRight: '6px' }} onDoubleClick={handleDoubleClick}>
          {node.data.iconLink ? ( //do i need this anymore?
            <img src={node.data.icon} alt="folder-icon" style={{ width: '32px', height: '32px' }} />
          ) : (
            <AiFillFolder color={node.isLeaf ? '#6bc7f6' : '#f6cf60'} />
          )}
        </span>
        {romdataStars && currentURLStars !== targetURLStars ? ( //don't navigate if we already clicked here (causes the tree to collapse)
          <Link to={targetURLStars}>{renderNodeText()}</Link>
        ) : (
          renderNodeText()
        )}
      </div>
    </div>
  )
}
