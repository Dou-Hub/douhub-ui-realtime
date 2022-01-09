//  Copyright PrimeObjects Software Inc. and other contributors <https://www.primeobjects.com/>
// 
//  This source code is licensed under the MIT license.
//  The detail information can be found in the LICENSE file in the root directory of this source tree.


import { useEffect, useState } from 'react';
import { getCurrentPoolUser, callAPI } from 'douhub-ui-web';

import { isFunction, isNil, isEmpty } from 'lodash';
import { isNonEmptyString, isObject, _window, _track } from 'douhub-helper-util';

export const currentRealtimeNetwork = (
    onSuccess?: any,
    onError?: any
): boolean => {
    const solution = _window.solution;
    const [connected, setConnected] = useState<boolean>(false);

    useEffect(() => {
        (async () => {
            if (!isNil(_window.realtimeNetwork) && isObject(solution)) {
                if (_track) console.log('realtime.syncClient.start');

                try {
                    //get the current cognito user
                    const poolUser = await getCurrentPoolUser(solution);

                    //only a valid cognito user can do realtime messaging
                    if (!isEmpty(poolUser)) {
                        
                        //get realtime token
                        const r = await callAPI(solution, `${solution.apis.realtime}token`, {}, 'GET');
                        if (isNil(_window._twilioSync)) _window._twilioSync = await import('twilio-sync');

                        _window.realtimeNetwork = new _window._twilioSync.SyncClient(r.token);

                        _window.realtimeNetwork.on('tokenAboutToExpire', function () {
                            (async () => {
                                //get new realtime token
                                const r = await callAPI(solution, `${solution.apis.realtime}token`, {}, 'GET');
                                _window.realtimeNetwork.updateToken(r.token);
                            })();
                        });

                        _window.realtimeNetwork.on('tokenExpired', function () {
                            (async () => {
                                //get new realtime token
                                const r = await callAPI(solution, `${solution.apis.realtime}token`, {}, 'GET');
                                _window.realtimeNetwork.updateToken(r.token);
                            })();
                        });

                        _window.realtimeNetwork.subscriptions = {};
                        if (_track) console.log('realtime.syncClient.success');
                        if (isFunction(onSuccess)) onSuccess('CREATED');
                    }
                }
                catch (error) {
                    _window.realtimeNetwork = null;
                    console.error('realtime.syncClient.error', error);
                    if (isFunction(onError)) onError(error);
                }
            }
            else {
                
                if (_track) console.log('realtime.syncClient.existing');
                if (isFunction(onSuccess)) onSuccess('EXISTING');
            }

            setConnected(isNil(_window.realtimeNetwork)?false:true);
        })();
    }, [_window, solution]);

    return connected;
}

export const createList = async (solution: Record<string, any>, data: Record<string, any>, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apis.realtime}create-list`, { ...settings, data }, 'POST');
}

export const upsertList = async (solution: Record<string, any>, data: Record<string, any>, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apis.realtime}update-list`, { ...settings, data }, 'PUT');
}

export const updateList = async (solution: Record<string, any>, data: Record<string, any>, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apis.realtime}update-list`, { ...settings, data }, 'PUT');
}

export const deleteList = async (solution: Record<string, any>, id: string, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apis.realtime}delete-list`, { ...settings, id }, 'DELETE');
}

export const createListItem = async (solution: Record<string, any>, data: Record<string, any>, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apis.realtime}create-list-item`, { ...settings, data }, 'POST');
}

export const deleteListItem = async (solution: Record<string, any>, data: Record<string, any>, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apis.realtime}delete-list-item`, { ...settings, data }, 'DELETE');
}

export const createDocument = async (solution: Record<string, any>, data: Record<string, any>, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apis.realtime}create-document`, { ...settings, data }, 'POST');
}

export const upsertDocument = async (solution: Record<string, any>, data: Record<string, any>, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apis.realtime}upsert-document`, { ...settings, data }, 'PUT');
}

export const updateDocument = async (solution: Record<string, any>, data: Record<string, any>, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apis.realtime}update-document`, { ...settings, data }, 'PUT');
}

export const deleteDocument = async (solution: Record<string, any>, id: string, settings: Record<string, any>) => {
    await callAPI(solution, `${solution.apis.realtime}delete-document`, { ...settings, id }, 'DELETE');
}

export const subscribeSyncClient = async (type: 'Document' | 'List', syncId: string, onEvent: any) => {
    const cacheKey = `${type}-${syncId}`;

    if (isObject(_window.realtimeNetwork) &&
        !isEmpty(_window.realtimeNetwork) &&
        isObject(_window.realtimeNetwork.subscriptions) &&
        !_window.realtimeNetwork.subscriptions[cacheKey]) {

        if (_track) console.log('realtime.subscribeSyncClient.start', type, syncId);

        return new Promise((resolve, reject) => {
            _window.realtimeNetwork[type.toLowerCase()](syncId)
                .then((result: any) => {

                    _window.realtimeNetwork.subscriptions[cacheKey] = new Date();
                    if (_track) console.log('realtime.subscribeSyncClient.success', syncId);

                    result.on('updated', function (event: any) {
                        onEvent({ type: 'DOC_UPDATED', data: event.data });
                    });
                    result.on('itemAdded', function (args: Record<string, any>) {
                        onEvent({ type: 'ITEM_ADDED', data: args.item });
                    });
                    result.on('itemRemoved', function (args: Record<string, any>) {
                        onEvent({ type: 'ITEM_REMOVED', data: args.item });
                    });
                    result.on('itemUpdated', function (args: Record<string, any>) {
                        onEvent({ type: 'ITEM_UPDATED', data: args.item });
                    });

                    resolve(result);
                })
                .catch((error: any) => {
                    console.error('realtime.subscribeSyncClient.failed', type, syncId, error);
                    reject(error);
                });
        });
    }
    else {
        if (_track) console.log('realtime.subscribeSyncClient.false', type, syncId);
        return null;
    }
}

export const useRealtimeSession = (
    type: 'Document' | 'List',
    syncId: string,
    onEvent: any,
    onError?: any): string | null => {

    const networkConnected = currentRealtimeNetwork();
    const [connected, setConnected] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                if (isNonEmptyString(syncId)) {
                    await subscribeSyncClient(type, syncId, onEvent);
                    setConnected(syncId);
                }
                else {
                    setConnected(null);
                }
            }
            catch (error: any) {
                console.error(error);
                setConnected(null);
                const message = `Failed to initialize the realtime comminication (${error?.statusMessage}).`;
                onError(message, error);
            }
        })();
    }, [networkConnected, syncId])

    return connected;
};