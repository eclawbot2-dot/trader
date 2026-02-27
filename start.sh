#!/bin/bash
cd /home/open-clawb_1/Projects/poly-edge-v2
export PORT=3100
export NODE_ENV=production
export NODE_TLS_REJECT_UNAUTHORIZED=0
exec node dist/index.js >> /tmp/poly-edge-v2.log 2>&1
