import React, { useState } from 'react'
import { Tree } from 'react-arborist'
function Treeview({ folderData, nodeData }) {
  const [treeData, setTreeData] = useState(folderData)
  function containsObjectWithoutId(arr) {
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i]
      if (typeof item === 'object') {
        if (!item.hasOwnProperty('id')) {
          return true
        }
        if (Array.isArray(item)) {
          if (containsObjectWithoutId(item)) {
            return true
          }
        }
      }
    }
    return false
  }
  console.log('containsObjectWithoutId', containsObjectWithoutId(folderData))

  const handleToggle = node => {
    node.isExpanded = !node.isExpanded
    setTreeData([...treeData]) // Update the treeData to trigger a re-render
  }
  const data = [
    {
      id: '1',
      name: 'public',
      children: [{ id: 'c1-1', name: 'index.html' }]
    },
    {
      id: '2',
      name: 'src',
      children: [
        { id: 'c2-1', name: 'App.js' },
        { id: 'c2-2', name: 'index.js' },
        { id: 'c2-3', name: 'styles.css' }
      ]
    },
    { id: '3', name: 'package.json' },
    { id: '4', name: 'README.md' }
  ]
  return (
    <Tree
      data={folderData}
      width={360}
      height={1000}
      indent={24}
      rowHeight={32}
      render={({ node, level, isExpanded, onToggle }) => (
        <div>
          <span onClick={() => handleToggle(node)}>{isExpanded ? '-' : '+'}</span>
          {node.name}
        </div>
      )}
    >
      {nodeData}
    </Tree>
  )
}

export { Treeview }
