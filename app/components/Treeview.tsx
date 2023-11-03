import React, { useState } from 'react'
import { Tree } from 'react-arborist'
function Treeview({ folderData, nodeData }) {
  return (
    <Tree data={folderData} openByDefault={false} width={360} height={1000} indent={24} rowHeight={42} padding={0}>
      {nodeData}
    </Tree>
  )
}

export { Treeview }
